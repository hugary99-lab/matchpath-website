// Pure post-model quality gate for MatchPath job discovery.
// Does not independently verify posting availability, employer identity or job requirements.
export function gateJobResults(rows, existing, minimumScore = 80, limit = 25) {
  const urlKey = raw => {
    try {
      const url = new URL(String(raw ?? ''));
      if (url.protocol !== 'https:') return '';
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key);
      return url.toString().replace(/\/$/, '');
    } catch { return ''; }
  };
  const reqKey = (company, req) => {
    const c = String(company ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    const r = String(req ?? '').trim().toLowerCase();
    return c && r ? `${c}::${r}` : '';
  };
  const suppressedUrls = new Set((existing || []).map(j => urlKey(j.job_url)).filter(Boolean));
  const suppressedReqs = new Set((existing || []).map(j => reqKey(j.company, j.requisition_id)).filter(Boolean));
  const seenUrls = new Set(), seenReqs = new Set();
  const score = Number(minimumScore);
  const threshold = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 80;
  const jobs = [];
  const dropped = { invalid: 0, below_threshold: 0, suppressed_existing: 0, duplicate: 0, over_limit: 0 };
  for (const j of Array.isArray(rows) ? rows : []) {
    const url = urlKey(j?.job_url), req = reqKey(j?.company, j?.requisition_id);
    if (!url || !String(j?.job_title ?? '').trim() || !String(j?.company ?? '').trim()) { dropped.invalid++; continue; }
    const fit = Number(j?.fit_score);
    if (!Number.isFinite(fit) || fit < threshold) { dropped.below_threshold++; continue; }
    if (suppressedUrls.has(url) || (req && suppressedReqs.has(req))) { dropped.suppressed_existing++; continue; }
    if (seenUrls.has(url) || (req && seenReqs.has(req))) { dropped.duplicate++; continue; }
    if (jobs.length >= limit) { dropped.over_limit++; continue; }
    jobs.push(j);
    seenUrls.add(url);
    if (req) seenReqs.add(req);
  }
  return { jobs, dropped, threshold };
}
