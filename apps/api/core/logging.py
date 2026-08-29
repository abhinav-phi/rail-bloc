from __future__ import annotations

import logging
import sys


def configure_logging() -> None:
    root = logging.getLogger()
    if root.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s'
    ))
    root.addHandler(handler)
    root.setLevel(logging.INFO)


logger = logging.getLogger("railbloc")
logger.addFilter(lambda record: setattr(record, "request_id", getattr(record, "request_id", "-")) or True)
