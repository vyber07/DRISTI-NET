"""Start the branch API for LOAD TESTING ONLY, with the API rate limits lifted so they do not mask pool behaviour
(the live code being compared has no API rate limits). Usage: run_branch_noratelimit.py PORT"""
import sys

from apps.api.app import config

config.API_IP_RATE_PER_MIN = 10 ** 9
config.API_USER_RATE_PER_MIN_BY_ROLE = {"DEFAULT": 10 ** 9, "ADMIN": 10 ** 9}

import uvicorn  # noqa: E402

uvicorn.run("apps.api.app.main:app", host="127.0.0.1", port=int(sys.argv[1]), log_level="warning")
