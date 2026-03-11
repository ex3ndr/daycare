---
name: domain-intel
description: Passive domain reconnaissance with bundled Python helpers. Use for subdomains, SSL expiry, DNS records, WHOIS, and lightweight availability checks.
---

# Domain Intelligence

Use the bundled helper for passive infrastructure questions.

## Helper Script

```bash
python3 SKILL_DIR/scripts/domain_intel.py subdomains example.com
python3 SKILL_DIR/scripts/domain_intel.py ssl example.com
python3 SKILL_DIR/scripts/domain_intel.py whois example.com
python3 SKILL_DIR/scripts/domain_intel.py dns example.com
python3 SKILL_DIR/scripts/domain_intel.py available example.com
python3 SKILL_DIR/scripts/domain_intel.py bulk example.com github.com --checks ssl,dns
```

All output is structured JSON.

## Use This For

- passive subdomain discovery
- certificate issuer and expiry checks
- WHOIS and registrar metadata
- DNS record inspection
- quick availability heuristics

## Use Other Tools For

- `web_search`: company or domain background research
- `web_fetch`: actual website content
- `exec` with `curl -I`: simple HTTP reachability checks

## Notes

- WHOIS on port 43 may be blocked on some networks
- Availability results are heuristic, not registrar-authoritative
- crt.sh lookups can be slow for very large domains
