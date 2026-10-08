"""Replace with convergence and constraint tests once the solver is implemented."""
import pytest
from app.solver.optimizer import optimize_allocations


@pytest.mark.skip(reason="Optimizer implementation pending")
def test_solver_convergence():
    optimize_allocations([], 0)
