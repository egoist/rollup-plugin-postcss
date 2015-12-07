import { expect } from 'chai';
import build from './build';
import jsdom from 'mocha-jsdom'
import requireFromString from 'require-from-string';

describe('main', () => {
  jsdom();
  it('test postcss', async done => {
    const data = await build().catch(err => console.log(err));
    requireFromString(data);
    try {
      const styles = window.getComputedStyle(document.body);
      expect(styles.margin).to.equal('0');
      done();
    }catch(err) {
      console.log(err);
    }
  });
});
