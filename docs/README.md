# DaoFlow 产品与设计资料

- [产品全景与返工思考资料](DaoFlow-产品全景与返工思考资料.md)
- [PDF 阅读版](DaoFlow-产品全景与返工思考资料.pdf)
- [独立 HTML 阅读版（内含截图）](DaoFlow-产品全景与返工思考资料.html)
- [设计优化说明](DaoFlow-高级感优化说明.md)
- [交互检查记录](DaoFlow-polish-verification.json)
- [响应式检查记录](DaoFlow-responsive-checks.json)

产品资料是 2026-09-06 整理时的快照，区分实际实现、未验证能力和返工建议。文档内本机路径用于原作者定位，并非部署地址。

## 本次提交补充
产品资料记录的历史导入脚本硬编码凭据，已在本次提交中改为读取环境变量。此变更不会清除 Git 历史中的旧值，也不代表旧凭据已在服务端撤销。仓库所有者仍需轮换相应凭据。

运行导入前设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。不要把环境文件或真实凭据提交到仓库。
