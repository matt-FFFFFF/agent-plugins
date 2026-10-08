# Demo plan

## TL;DR (For humans)
Three tasks deliver a verified change.
**Effort:** Short

## Scope
The demonstration stays local.

## Verification strategy
Run the checker tests.

## Execution strategy
### Parallel execution waves
- Wave 1: 1, 2
- Wave 2: 3
### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | - | 3 | 2 |
| 2 | - | 3 | 1 |
| 3 | 1, 2 | - | - |

## Todos
- [ ] 1. Prepare inputs
  Recommended task executor category: quick - small preparation
  Parallelization: Wave 1 | Blocked by: none | Blocks: 3
  References: inputs.md
  Acceptance criteria: inputs exist
  QA scenarios: inspect inputs
  Commit: Y | Prepare inputs
```md
- [ ] 9. ignored
```
- [ ] 2. Prepare outputs
  Recommended task executor category: writing - document results
  Parallelization: Wave 1 | Blocked by: none | Blocks: 3
  References: outputs.md
  Acceptance criteria: outputs exist
  QA scenarios: inspect outputs
  Commit: N | Included with inputs
- [ ] 3. Verify change
  Recommended task executor category: deep-low - check integration
  Parallelization: Wave 2 | Blocked by: 1, 2 | Blocks: none
  References: verification.md
  Acceptance criteria: verification passes
  QA scenarios: run verification
  Commit: Y | Verify change

## Final verification wave
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Ideal-state fidelity

## Commit strategy
Commit each independent change after verification.

## Success criteria
| IS | Delivering todo(s) | Proving QA scenario | Evidence |
| --- | --- | --- | --- |
| IS-1 | 1, 2, 3 | Run verification | verification.txt |
