import { createFilter, makeLegalIdentifier } from 'rollup-pluginutils';
import postcss from 'postcss';
import styleInject from 'style-inject';
import path from 'path';

function pathJoin (file) {
  return path.join(process.cwd(), file);
}

export default function (options = {}) {
  const filter = createFilter( options.include, options.exclude );
  return {
    intro () {
      return styleInject.toString();
    },
    transform (code, id) {
      if (!filter( id ) || id.slice( -4 ) !== '.css') {
        return null;
      }
      const opts = {
        from: options.from ? pathJoin(options.from) : id,
        to: options.to ? pathJoin(options.to) : id,
        map: {
          inline:     false,
          annotation: false
        }
      };
      code = postcss(options.plugins || []).process(code, opts).css;
      code = `export default styleInject(${JSON.stringify(code)});`
      return {
        code,
        map: { mappings: '' }
      };
    }
  };
};
