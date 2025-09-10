# OSI-Layer Security Posture

- Physical: Cloud/IaC controls (DC security, HSMs, backups). Action: enforce provider best practices.
- Data Link: Network segmentation/VLANs, MAC filtering (infra-level). Action: enforced via VPC/VNET design.
- Network: Firewalls/security groups, DDoS protection, IP allowlists. Action: restrict ingress, rate shapes.
- Transport: TLS 1.2+, HSTS, perfect forward secrecy. Action: terminate at edge; pin ciphers.
- Session: Strong session management, CSRF, cookie flags. Action: use secure/httponly/samesite; JWT rotation.
- Presentation: Input validation, schema checks, CSP/helmet. Action: current FastAPI validation; add Helmet for Node.
- Application: AuthZ, RBAC, logging, RASP, WAF rules, rate limits. Action: added rate limit, payload limits, upload filters; CI scans.

Hardening backlog:

- Add `helmet` + CSP to `server`.
- Strict origin allowlist per environment.
- Structured audit logs to SIEM; anomaly alerts.
- WAF: block uncommon methods, path allowlists, basic bot filters.
