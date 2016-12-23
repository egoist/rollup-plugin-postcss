// Taken from glamor
//
function last(arr) {
  return arr[arr.length -1];
}

function sheetForTag(tag) {
  if (tag.sheet) {
    return tag.sheet;
  }

  // this weirdness brought to you by firefox
  for (let i = 0; i < document.styleSheets.length; i++) {
    if (document.styleSheets[i].ownerNode === tag) {
      return document.styleSheets[i];
    }
  }
}

var oldIE = (() => {
  let div = document.createElement('div');
  div.innerHTML = '<!--[if lt IE 10]><i></i><![endif]-->';
  return div.getElementsByTagName('i').length === 1;
})();

function makeStyleTag() {
  let tag = document.createElement('style');
  tag.type = 'text/css';
  tag.appendChild(document.createTextNode(''));
  (document.head || document.getElementsByTagName('head')[0]).appendChild(tag);
  return tag;
}

function StyleSheet() {
  this.sheet = undefined;
  this.tags = [];
  this.maxLength = oldIE ? 4000 : 65000;
  this.ctr = 0;

  this.inject();
};

StyleSheet.prototype = {
  getSheet: function() {
    return sheetForTag(last(this.tags));
  },

  inject: function() {
    this.tags[0] = makeStyleTag();
    this.injected = true;
  },

  _insert: function(rule) {
    // this weirdness for perf, and chrome's weird bug
    // https://stackoverflow.com/questions/20007992/chrome-suddenly-stopped-accepting-insertrule
    try {
      let sheet = this.getSheet();
      sheet.insertRule(rule, rule.indexOf('@import') !== -1 ? 0 : sheet.cssRules.length);
    } catch (e) {
      //XXX
    }
  },

  insert: function(rule) {
    // this is the ultrafast version, works across browsers
    if (this.getSheet().insertRule) {
      this._insert(rule);
    } else {
      if (rule.indexOf('@import') !== -1) {
        const tag = last(this.tags);
        tag.insertBefore(document.createTextNode(rule), tag.firstChild);
      } else {
        last(this.tags).appendChild(document.createTextNode(rule));
      }
    }

    this.ctr++;
    if (this.ctr % this.maxLength === 0) {
      this.tags.push(makeStyleTag());
    }
    return this.ctr -1;
  },
};

var styleSheet = new StyleSheet();

export default function injectStyle(css) {
  styleSheet.insert(css);
}
