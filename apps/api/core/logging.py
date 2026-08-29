import logging
from typing import Any


def configure_logging() -> None:
    logger = logging.getLogger("railbloc")
    if logger.handlers:
        return

    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    logger.addHandler(handler)
    logger.propagate = False


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(f"railbloc.{name}")


def make_log_extra(**kwargs: Any) -> dict[str, Any]:
    return {"request_id": kwargs.get("request_id"), **kwargs}
