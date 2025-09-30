import inspect
from typing import ForwardRef

_forward_ref_signature = inspect.signature(ForwardRef._evaluate)
if "recursive_guard" in _forward_ref_signature.parameters:  # pragma: no cover - compatibility shim
    _original_forward_ref_evaluate = ForwardRef._evaluate

    def _patched_forward_ref_evaluate(self, globalns, localns, *args, **kwargs):
        if "recursive_guard" not in kwargs and args:
            kwargs["recursive_guard"] = args[-1]
            args = args[:-1]
        return _original_forward_ref_evaluate(self, globalns, localns, *args, **kwargs)

    ForwardRef._evaluate = _patched_forward_ref_evaluate
