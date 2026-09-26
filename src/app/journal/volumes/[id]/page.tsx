import { VolumeDetail } from '@/components/v2/journal/VolumeDetail'
export default async function VolumePage(props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  return <VolumeDetail id={params.id}/>
}
