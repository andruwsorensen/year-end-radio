# Grow-server deployment

Year-End Radio runs in Docker on `grow-server` and is available only inside the Tailscale network. Pushes to `main` are validated on a GitHub-hosted runner and deployed by a repository-specific runner on grow-server.

## Production address

```text
https://year-end-radio.civet-nessie.ts.net
```

Tailscale access-control rules still apply. The container port is bound only to `127.0.0.1`, so it is not directly exposed to the LAN or public internet.

The address belongs to the `svc:year-end-radio` Tailscale Service. Tailscale terminates HTTPS on the Service's virtual IP and proxies requests to `http://127.0.0.1:4173`, so it can use the standard HTTPS port without conflicting with grow-server's shared Caddy proxy on the machine's own port `443`.

The Tailscale configuration has three related controls:

- `grow-server` has the `tag:server` identity.
- `tag:server` automatically approves hosts for `svc:year-end-radio`.
- `autogroup:member` can reach `svc:year-end-radio` on `tcp:443`.

To recreate the host mapping after the Service and policies exist:

```sh
tailscale serve clear svc:year-end-radio
tailscale serve --service=svc:year-end-radio --https=443 --yes http://127.0.0.1:4173
```

The first HTTPS request can take about a minute while Tailscale obtains the Service certificate.

## Deployment flow

1. GitHub runs `npm run check` with Node.js 22.
2. GitHub builds the production Docker image as a reproducibility check.
3. The `year-end-radio` self-hosted runner rebuilds and starts the Compose service on grow-server.
4. The workflow verifies both the local health endpoint and the private Tailscale HTTPS address.

The health response must include `"ytdlpAvailable":true`; a running Node server without `yt-dlp` is not considered a successful deployment.

The runner is managed by the checked-in `deploy/github-runner-year-end-radio.service` unit and uses the repository-specific `year-end-radio` label.

## Routine commands

Run these commands on grow-server:

```sh
cd ~/actions-runner/year-end-radio/_work/year-end-radio/year-end-radio
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 app
curl -fsS http://127.0.0.1:4173/api/health
tailscale serve status
curl -fsS https://year-end-radio.civet-nessie.ts.net/api/health
```

Deployments normally happen by pushing to `main`. The workflow can also be started manually from the repository's **Actions** page.

## Restart or rebuild manually

```sh
cd ~/actions-runner/year-end-radio/_work/year-end-radio/year-end-radio
docker compose -f compose.production.yml up -d --build
```

## Stop the app

```sh
cd ~/actions-runner/year-end-radio/_work/year-end-radio/year-end-radio
docker compose -f compose.production.yml down
```

Stopping Compose does not remove the source checkout or the GitHub runner. Tailscale Serve will return an upstream error until the app starts again.

## Troubleshooting

If the container is unhealthy, inspect its logs and confirm that `/api/health` reports `yt-dlp` as available. If the local endpoint works but the private URL does not, check `tailscale serve status`, the Service host state in the Tailscale admin console, MagicDNS, HTTPS certificate status, and the Service auto-approver and access-grant policies above.
