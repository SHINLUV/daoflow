-- T06 query/export slice. Apply after 003, 004 and 005 to an isolated project only.

create or replace function public.export_journal_snapshot(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := public.require_journal_user(); v_result jsonb;
begin
  if p_from is not null and p_to is not null and p_from >= p_to then raise exception 'INVALID_EXPORT_RANGE' using errcode='22023'; end if;
  -- One SQL statement gives every CTE the same MVCC snapshot.  Private rows are
  -- explicitly scoped even though this SECURITY DEFINER function bypasses RLS.
  with ranged_volumes as (select * from public.journal_volumes where user_id=v_user and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)),
  ranged_entries as (select * from public.journal_entries where user_id=v_user and ((p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to) or volume_id in (select id from ranged_volumes))),
  ranged_asks as (select * from public.ask_sessions where user_id=v_user and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to)),
  included_entries as (select e.*, false as included_as_reference from ranged_entries e union all select e.*, true from public.journal_entries e where e.user_id=v_user and e.id in (select source_entry_id from ranged_asks where source_entry_id is not null) and not exists (select 1 from ranged_entries r where r.id=e.id)),
  included_volumes as (select v.*, false as included_as_reference from ranged_volumes v union all select v.*, true from public.journal_volumes v where v.user_id=v_user and (v.id in (select volume_id from included_entries where volume_id is not null) or v.id in (select volume_id from ranged_asks where volume_id is not null) or v.id=(select last_volume_id from public.journal_preferences where user_id=v_user)) and not exists(select 1 from ranged_volumes r where r.id=v.id)),
  ranged_favorites as (select * from public.journal_favorites where user_id=v_user and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to))
  select jsonb_build_object('schemaVersion',1,'exportedAt',now(),'filter',jsonb_build_object('from',p_from,'to',p_to),
    'entries',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,'mood',mood,'volumeId',volume_id,'version',version,'deletedAt',deleted_at,'createdAt',created_at,'updatedAt',updated_at,'includedAsReference',included_as_reference) order by created_at,id) from included_entries),'[]'::jsonb),
    'volumes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'archivedAt',archived_at,'version',version,'createdAt',created_at,'updatedAt',updated_at,'includedAsReference',included_as_reference) order by created_at,id) from included_volumes),'[]'::jsonb),
    'favorites',coalesce((select jsonb_agg(jsonb_build_object('id',id,'chapterId',chapter_id,'excerpt',excerpt,'note',note,'version',version,'createdAt',created_at,'updatedAt',updated_at) order by created_at,id) from ranged_favorites),'[]'::jsonb),
    'askSessions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'question',question,'response',ai_response,'followUpQuestion',follow_up_question,'matchedChapterId',matched_chapter_id,'provider',ai_provider,'degraded',degraded,'fallbackReason',fallback_reason,'sourceEntryId',source_entry_id,'volumeId',volume_id,'createdAt',created_at) order by created_at,id) from ranged_asks),'[]'::jsonb),
    'preferences',coalesce((select jsonb_build_object('lastVolumeId',last_volume_id,'updatedAt',updated_at) from public.journal_preferences where user_id=v_user),'null'::jsonb)) into v_result;
  if octet_length(v_result::text) > 5242880 then raise exception 'EXPORT_TOO_LARGE' using errcode='54000'; end if;
  return v_result;
end; $$;

revoke all on function public.export_journal_snapshot(timestamptz,timestamptz) from public, anon;
grant execute on function public.export_journal_snapshot(timestamptz,timestamptz) to authenticated;
