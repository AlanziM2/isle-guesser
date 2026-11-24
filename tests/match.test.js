const test = require('node:test');
const assert = require('node:assert');
const { checkGuess, shuffle } = require('../match.js');

const I = (name, aliases = []) => ({ name, aliases });

test('accents and "and"', () => assert.strictEqual(checkGuess('sao tome and principe', I('São Tomé and Príncipe')), 'correct'));
test('typo long name', () => assert.strictEqual(checkGuess('Madagaskar', I('Madagascar')), 'correct'));
test('short names strict', () => assert.notStrictEqual(checkGuess('aruba', I('Cuba')), 'correct'));
test('st -> saint', () => assert.strictEqual(checkGuess('st lucia', I('Saint Lucia')), 'correct'));
test('leading the', () => assert.strictEqual(checkGuess('the bahamas', I('Bahamas')), 'correct'));
test('jamica', () => assert.strictEqual(checkGuess('jamica', I('Jamaica')), 'correct'));
test('alias', () => assert.strictEqual(checkGuess('east timor', I('Timor-Leste', ['East Timor'])), 'correct'));
test('close hint', () => assert.strictEqual(checkGuess('madagsacr', I('Madagascar')), 'close'));
test('shuffle keeps elements', () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.deepStrictEqual(shuffle(a).sort(), a);
});

const { suggest } = require('../match.js');
const LIST = [I('Madagascar'), I('Jamaica'), I('Cuba'), I('Aruba'), I('Malta')];
test('suggest nearest name', () => assert.strictEqual(suggest('madagsacr', LIST), 'Madagascar'));
test('suggest nothing for exact names', () => assert.strictEqual(suggest('cuba', LIST), null));
test('suggest nothing for nonsense', () => assert.strictEqual(suggest('qwertyuiop', LIST), null));
