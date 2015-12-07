import postcss from 'postcss';
import styleInject from 'style-inject';

export default function (options = {}) {
  return {
    intro () {
      return styleInject.toString();
    },
    transform (code, id) {
      if (id.slice( -4 ) !== '.css') {
        return null;
      }
      code = postcss(options.plugins || []).process(code).css;
      code = `export default styleInject(${JSON.stringify(code)});`
      return {
        code,
        map: { mappings: '' }
      };
    }
  };
};
