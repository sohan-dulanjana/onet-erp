import { BadRequestException } from '@nestjs/common';
import { evaluateFormulaExpression } from './formula-formats.service';
describe('evaluateFormulaExpression', () => {
  it('evaluates arithmetic and variables', () => expect(evaluateFormulaExpression('(W + 2 * D) * H', { W: 600, H: 1000, D: 200 })).toBe(1000000));
  it('supports approved functions', () => expect(evaluateFormulaExpression('max(W, 400) + ceil(H / 100)', { W: 300, H: 901 })).toBe(410));
  it('supports exponentiation', () => expect(evaluateFormulaExpression('W^2', { W: 3 })).toBe(9));
  it('rejects unknown variables', () => expect(() => evaluateFormulaExpression('W + secret', { W: 2 })).toThrow(BadRequestException));
  it('rejects executable expressions', () => expect(() => evaluateFormulaExpression('process.exit(1)', {})).toThrow(BadRequestException));
  it('rejects division by zero', () => expect(() => evaluateFormulaExpression('10 / 0', {})).toThrow(BadRequestException));
});
