# Authorization policy (prototype)

Decision = ALLOW iff all hold (evaluated server-side in `apps/api/app/auth.py::authorize_case`, denial audited):

1. the token is valid and the user is active;
2. the user is ADMIN or AUDITOR, **or** is assigned to the case (or owns it);
3. the user's jurisdiction equals the case jurisdiction (ADMIN/AUDITOR exempt);
4. the route's role allow-list includes the user's role (e.g. only REVIEWER / INVESTIGATOR / ADMIN may decide; only
   INVESTIGATOR / REVIEWER / ADMIN may reveal masked values).

Masking is applied after authorization: PHONE and ACCOUNT values are masked in every response unless an audited reveal is requested.
Moving this to OPA: the four rules above become one `allow` rule over `{user, case, action}` input.
