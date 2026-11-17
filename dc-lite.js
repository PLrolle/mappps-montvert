/* dc-lite.js — minimal standalone renderer for MAPPPS demonstrator pages.
   Supports {{path}} holes, <sc-for>, <sc-if>, event handlers (onClick, onChange),
   and a React-like setState on a DCLogic component. No dependencies. */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function literal(p) {
    if (p === 'true') return { v: true };
    if (p === 'false') return { v: false };
    if (p === 'null') return { v: null };
    if (/^-?\d+(\.\d+)?$/.test(p)) return { v: Number(p) };
    if (/^'.*'$|^".*"$/.test(p)) return { v: p.slice(1, -1) };
    return null;
  }

  function lookup(path, scope) {
    var l = literal(path);
    if (l) return l.v;
    var parts = path.split('.');
    var v, found = false;
    for (var i = scope.length - 1; i >= 0; i--) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) {
        v = scope[i][parts[0]]; found = true; break;
      }
    }
    if (!found) return undefined;
    for (var k = 1; k < parts.length; k++) {
      if (v == null) return undefined;
      v = v[parts[k]];
    }
    return v;
  }

  function interp(s, scope) {
    return s.replace(HOLE, function (m, p) {
      var v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }

  function render(nodes, scope, parent, svg) {
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      if (typeof node === 'string') {
        parent.appendChild(document.createTextNode(interp(node, scope)));
        continue;
      }
      var tag = node[0], attrs = node[1], kids = node[2];
      if (tag === 'sc-for') {
        var mf = WHOLE.exec(attrs.list || '');
        var list = mf ? lookup(mf[1], scope) : [];
        var as = attrs.as || 'item';
        (list || []).forEach(function (it, i) {
          var frame = { $index: i }; frame[as] = it;
          render(kids, scope.concat([frame]), parent, svg);
        });
        continue;
      }
      if (tag === 'sc-if') {
        var mi = WHOLE.exec(attrs.value || '');
        if (mi && lookup(mi[1], scope)) render(kids, scope, parent, svg);
        continue;
      }
      var isSvg = svg || tag === 'svg';
      var el = isSvg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
      Object.keys(attrs).forEach(function (k) {
        if (k.indexOf('hint-') === 0) return;
        var raw = attrs[k];
        var m = WHOLE.exec(raw);
        if (!m) { el.setAttribute(k, interp(raw, scope)); return; }
        var val = lookup(m[1], scope);
        if (/^on[A-Z]/.test(k)) {
          if (typeof val === 'function') {
            var ev = k.slice(2).toLowerCase();
            if (ev === 'change' && (tag === 'textarea' || tag === 'input')) ev = 'input';
            el.addEventListener(ev, val);
          }
          return;
        }
        if (k === 'value' && (tag === 'textarea' || tag === 'input')) {
          var sv = val == null ? '' : String(val);
          if (tag === 'textarea') el.textContent = sv;
          el.value = sv;
          return;
        }
        if (typeof val === 'boolean') {
          if (k.indexOf('aria-') === 0) el.setAttribute(k, String(val));
          else if (val) el.setAttribute(k, '');
          return;
        }
        if (val != null) el.setAttribute(k, String(val));
      });
      render(kids, scope, el, isSvg && tag !== 'foreignObject');
      parent.appendChild(el);
    }
  }

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (u) {
    var patch = typeof u === 'function' ? u(this.state, this.props) : u;
    this.state = Object.assign({}, this.state, patch);
    if (this.__render) this.__render();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };

  function mount(Component, tpl, props) {
    var root = document.getElementById('app');
    var c = new Component(props || {});
    c.__render = function () {
      var a = document.activeElement;
      var id = a && a.id;
      var ss = a && a.selectionStart, se = a && a.selectionEnd;
      var sx = window.scrollX, sy = window.scrollY;
      var frag = document.createDocumentFragment();
      render(tpl, [c.renderVals()], frag, false);
      root.replaceChildren(frag);
      if (id) {
        var e = document.getElementById(id);
        if (e) { e.focus(); try { e.setSelectionRange(ss, se); } catch (_) {} }
      }
      window.scrollTo(sx, sy);
    };
    c.__render();
    if (c.componentDidMount) c.componentDidMount();
  }

  window.DCLogic = DCLogic;
  window.DCLite = { mount: mount };
})();
