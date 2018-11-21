/*
 * @Name: TimeScale 时间轴插件
 * @Author: a-ke 
 * @Date: 2018-10-29 11:02:43 
 * @Last Modified by: a-ke
 * @Last Modified time: 2018-11-21 13:29:12
 */
;(function() {
  var ready = {
    //获取当前脚步的基础路径
    getPath: function() {
      var jsPath = document.currentScript ? document.currentScript.src: (function(){
        var js = document.scripts,
        last = js.length - 1,
        src;
        for (var i = last; i > 0; i--) {
          if (js[i].readyState === 'interactive') {
            src = js[i].src;
            break;
          }
        }
        return src || js[last].src;
      })();
      return jsPath.substring(0, jsPath.lastIndexOf('/') + 1);
    }()

    //获取节点的style属性值
    ,getStyle: function(node, name) {
      // var style = node.currentStyle ? node.currentStyle : window.getComputedStyle(node, null);
      // return style[style.getPropertyValue ? 'getPropertyValue' : 'getAttribute'](name);
      return window.getComputedStyle(node)[name];
    }

    //载入css配件
    ,link: function(href, fn, cssname) {

      //未设置路径，则不主动加载css
      if(!timescale.path) return;

      var head = document.getElementsByTagName('head')[0], link = document.createElement('link');
      if (typeof fn === 'string') cssname = fn;
      var app = (cssname || href).replace(/\.|\//g, '');
      var id = 'timescale-' + app, timeout = 0;

      link.rel = 'stylesheet';
      link.href = timescale.path + href;
      link.id = id;

      if (!document.getElementById(id)) {
        head.appendChild(link);
      }

      if (typeof fn !== 'function') return;

      //轮巡css是否加载完毕
      (function poll() {
        if (++timeout > 8 * 1000 / 100) {
          return window.console || console.error('timescale.css: Invalid');
        };
        parseInt(ready.getStyle(document.getElementById(id), 'width')) === 1989 ? fn() : setTimeout(poll, 100);
      })();
    }

    //载入依赖的js文件
    ,script: function(src, fn, jsname) {
      //未设置路径，则不主动加载js
      if (!timescale.path) return;
      if (typeof fn === 'string') jsname = fn;
      var app = (jsname || src).replace(/\.|\//g, '');
      var id = 'timescale-' + app,
      timeout = 0;

      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = timescale.path + src;
      script.id = id;

      if (!document.getElementById(id)) {
        document.body.appendChild(script);
      }

      if (typeof fn !== 'function') return;
      (function poll() {
        if (++timeout > 8 * 1000 / 100) {
          return window.console || console.error('konva.js: Invalid');
        }
        window.Konva ? fn() : setTimeout(poll, 100);
      })();
    }
  }

  ,timescale = {
    v: '1.0.0',
    config: {}, //全局配置项
    path: !window.Konva ? ready.getPath : '',
    
    //设置全局项
    set: function(options) {
      var that = this;
      that.config  = $.extend({}, that.config, options);
      return that;
    },

    //主体css等待事件
    ready: function(fn) {
      var cssname = 'timescale',
      path = 'css/timescale.css?v=' + timescale.v;
      ready.link(path, cssname);
      // ready.link(path, function() {
        //引入依赖的konva.js文件
        ready.script('js/konva.min.js', fn, 'konva');
      // }, cssname);
    },

  }

  //颜色值
  ,backgroundColor = '#141F39', fontColor = '#fff', iconColor = '#097DB1', cursorColor = '#FF6600'
  
  //操作当前实例
  ,thisTimeScale = function() {
    var that = this;
    return {
      config: that.config,
      reload: that.reload.bind(that),
      seekTo: that.seekTo.bind(that),
      play: that.play.bind(that),
      pause: that.pause.bind(that),
      createIndex: that.createIndex.bind(that),
      on: that.on.bind(that),
      off: that.off.bind(that)
    };
  }

  //组件构造器
  ,Class = function(options) {
    var that = this;
    that.config = $.extend({}, that.config, timescale.config, options);
    backgroundColor = that.config.backgroundColor || backgroundColor;
    fontColor = that.config.fontColor || fontColor;
    iconColor = that.config.fontColor || iconColor;
    cursorColor = that.config.cursorColor || cursorColor;

    //konva全局变量
    this.konva = {
      stage: null, // 舞台
      layer: null, //动态图层
      staticLayer: null, // 静态图层
      clipGroup: null, //剪辑片段分组
      indexGroup: null, //索引分组
      delClipEle: [], //将要删除的剪辑元素
      delIndexEle: [] //将要删除的索引元素
    };
    //事件队列(key为事件名，value为数组，数组内存放事件的回调函数)
    that.eventListObj = {};

    //变量初始化
    that.containerWidth = 0; //容器的宽度
    that.containerHeight = 0; //容器的高度
    that.mainTopBottomMargin = 20;
    that.aTotalTime = 60 * 60 * 1000; //默认总时间为一个小时
    that.currentTime = 0; // 当前时间
    // that.playing = false;
    that.scale = 1;
    that.maxScale = false; //放大是否达到最大
    that.clippedArr = []; //剪掉的片段 [{startTime: 1000, endTime: 2000}]
    that.indexArr = []; //索引 [1000, 2000, 3000]
    //m_n 代表一屏
    that.m_nBeginTime = 0;
    that.m_nTotalTime = 0;

    timescale.ready(function() {
      that.init();
    });
  }

  //DOM查找
  ,$ = function(selector){   
    return new JQ(selector);
  }
  
  //DOM构造器
  ,JQ = function(selector){
    var index = 0
    ,nativeDOM = typeof selector === 'object' ? [selector] : (
      this.selector = selector
      ,document.querySelectorAll(selector || null)
    );
    for(; index < nativeDOM.length; index++){
      this.push(nativeDOM[index]);
    }
  };

  //普通对象深度扩展
  $.extend = function(){
    var ai = 1, args = arguments
    ,clone = function(target, obj){
      target = target || (obj.constructor === Array ? [] : {}); 
      for(var i in obj){
        //如果值为对象，则进入递归，继续深度合并
        target[i] = (obj[i] && (obj[i].constructor === Object))
          ? clone(target[i], obj[i])
        : obj[i];
      }
      return target;
    }

    args[0] = typeof args[0] === 'object' ? args[0] : {};

    for(; ai < args.length; ai++){
      if(typeof args[ai] === 'object'){
        clone(args[0], args[ai])
      }
    }
    return args[0];
  };
  //对象遍历
  $.each = function(obj, fn){
    var key
    ,that = this;
    if(typeof fn !== 'function') return that;
    obj = obj || [];
    if(obj.constructor === Object){
      for(key in obj){
        if(fn.call(obj[key], key, obj[key])) break;
      }
    } else {
      for(key = 0; key < obj.length; key++){
        if(fn.call(obj[key], key, obj[key])) break;
      }
    }
    return that;
  };

  //数字前置补零
  $.digit = function(num, length){
    var str = '';
    num = String(num);
    length = length || 2;
    for(var i = num.length; i < length; i++){
      str += '0';
    }
    return num < Math.pow(10, length) ? str + (num|0) : num;
  };

  //函数节流
  $.throttle = function(fun, delay) {
    var last, deferTimer;
    return function() {
        var that = this;
        var _args = arguments;
        var now = +new Date();
        //取当前时间和之前记录的时间对比，如果超过了规定的间隔则立即执行
        if (last && now < last + delay) {
            clearTimeout(deferTimer);
            deferTimer = setTimeout(function() {
                fun.apply(that, _args);
            }, delay);
        } else {
            last = now;
            fun.apply(that, _args);
        }
    }
  };

  //时间转换（毫秒秒转时分秒）
  $.msToHMS = function(time) {
    var hour, min, sec, time = time / 1000;
    hour = parseInt(time / (60 * 60));
    min = parseInt((time % (60 * 60)) / 60);
    sec = parseInt(time % 60);
    return $.digit(hour, 2) + ':' + $.digit(min, 2) + ':' + $.digit(sec, 2);
  };

  JQ.prototype = [];
  JQ.prototype.constructor = JQ;

  //追加字符
  JQ.addStr = function(str, new_str){
    str = str.replace(/\s+/, ' ');
    new_str = new_str.replace(/\s+/, ' ').split(' ');
    $.each(new_str, function(ii, item){
      if(!new RegExp('\\b'+ item + '\\b').test(str)){
        str = str + ' ' + item;
      }
    });
    return str.replace(/^\s|\s$/, '');
  };
  
  //移除值
  JQ.removeStr = function(str, new_str){
    str = str.replace(/\s+/, ' ');
    new_str = new_str.replace(/\s+/, ' ').split(' ');
    $.each(new_str, function(ii, item){
      var exp = new RegExp('\\b'+ item + '\\b')
      if(exp.test(str)){
        str = str.replace(exp, '');
      }
    });
    return str.replace(/\s+/, ' ').replace(/^\s|\s$/, '');
  };
  
  //查找子元素
  JQ.prototype.find = function(selector){
    var that = this;
    var index = 0, arr = []
    ,isObject = typeof selector === 'object';
    
    this.each(function(i, item){
      var nativeDOM = isObject ? [selector] : item.querySelectorAll(selector || null);
      for(; index < nativeDOM.length; index++){
        arr.push(nativeDOM[index]);
      }
      that.shift();
    });
    
    if(!isObject){
      that.selector =  (that.selector ? that.selector + ' ' : '') + selector
    }
    
    $.each(arr, function(i, item){
      that.push(item);
    });
    
    return that;
  };
  //DOM遍历
  JQ.prototype.each = function(fn){
    return $.each.call(this, this, fn);
  };
  JQ.prototype.addClass = function(className, type) {
     return this.each(function(index, item){
      item.className = JQ[type ? 'removeStr' : 'addStr'](item.className, className)
    });
  };

  //移除css类
  JQ.prototype.removeClass = function(className){
    return this.addClass(className, true);
  };

  //是否包含css类
  JQ.prototype.hasClass = function(className){
    var has = false;
    this.each(function(index, item){
      if(new RegExp('\\b'+ className +'\\b').test(item.className)){
        has = true;
      }
    });
    return has;
  };

  JQ.prototype.css=function(attr,value){
    //遍历选取当前元素
    for(var i=0;i<this.length;i++){
      this[i].style[attr]=value;
    }
    return this;
  }

  //添加或获取属性
  JQ.prototype.attr = function(key, value){
    var that = this;
    return value === undefined ? function(){
      if(that.length > 0) return that[0].getAttribute(key);
    }() : that.each(function(index, item){
      item.setAttribute(key, value);
    });   
  };
  
  //移除属性
  JQ.prototype.removeAttr = function(key){
    return this.each(function(index, item){
      item.removeAttribute(key);
    });
  };
  
  //设置HTML内容
  JQ.prototype.html = function(html){
    return this.each(function(index, item){
      item.innerHTML = html;
    });
  };
  
  //设置值
  JQ.prototype.val = function(value){
    return this.each(function(index, item){
      item.value = value;
    });
  };
  
  //追加内容
  JQ.prototype.append = function(elem){
    return this.each(function(index, item){
      typeof elem === 'object' 
        ? item.appendChild(elem)
      :  item.innerHTML = item.innerHTML + elem;
    });
  };
  
  //移除内容
  JQ.prototype.remove = function(elem){
    return this.each(function(index, item){
      elem ? item.removeChild(elem) : item.parentNode.removeChild(item);
    });
  };
  
  //事件绑定
  JQ.prototype.on = function(eventName, fn){
    return this.each(function(index, item){
      item.attachEvent ? item.attachEvent('on' + eventName, function(e){
        e.target = e.srcElement;
        fn.call(item, e);
      }) : item.addEventListener(eventName, fn, false);
    });
  };
  
  //解除事件
  JQ.prototype.off = function(eventName, fn){
    return this.each(function(index, item){
      item.detachEvent 
        ? item.detachEvent('on'+ eventName, fn)  
      : item.removeEventListener(eventName, fn, false);
    });
  };

  //绘制刻度线
  Class.prototype.drawLineF = function(layer) {
    // var that = this;
    var m_nParts = 0; //分为几大格
    var fScrap = 0; //不足一个大格的像素宽度
    var m_nBigCellTimeSpan = 0; //每个大格的时长(毫秒)
    var maxParts = 14; //一屏时间最多分多少个大格
    var m_nTotalTime = this.m_nTotalTime; //一屏区域将要显示的时长(毫秒)
    var m_nBeginTime = this.m_nBeginTime; //一屏区域开始的时间(毫秒)
    var m_nBigCellWidth = 0; //每个大格的宽度

    if (m_nTotalTime > 60 * 60 * 1000) {
      //时长大于一个小时的情况，单位等级：10分-20分-40分-80分...
      m_nBigCellTimeSpan = 10 * 60 * 1000; //初始10分钟一个大格(毫秒)
      do {
        m_nParts = parseInt(m_nTotalTime / m_nBigCellTimeSpan);
        fScrap = (m_nTotalTime % m_nBigCellTimeSpan) * (this.containerWidth / m_nTotalTime);
        m_nBigCellTimeSpan *= 2;
      } while(m_nParts > maxParts);

      m_nBigCellTimeSpan /= 2; //最终使用的Timespan
    } else if (m_nTotalTime > maxParts * 10 * 1000) {
      //时长小于1小时大于maxParts * 10 秒的情况，单位等级：20秒-40秒-60秒(1分)-5分<此时大格数肯定不会大于17个>
      m_nBigCellTimeSpan = 20 * 1000; //初始20秒一个大格(毫秒)
      m_nParts = maxParts + 1;
      for(var i = 0; i < 3 && m_nParts > maxParts; i++) {
        m_nParts = parseInt(m_nTotalTime / m_nBigCellTimeSpan);
        fScrap = (m_nTotalTime % m_nBigCellTimeSpan) * (this.containerWidth / m_nTotalTime);
        m_nBigCellTimeSpan += 20 * 1000;
      }
      m_nBigCellTimeSpan -= 20 * 1000; //最终使用的Timespan
      if (m_nParts > maxParts) {
        //1分钟等级分格仍然太多，则使用5分钟等级
        m_nBigCellTimeSpan = 5 * 60 * 1000;
        m_nParts = parseInt(m_nTotalTime / m_nBigCellTimeSpan);
        fScrap = (m_nTotalTime % m_nBigCellTimeSpan) * (this.containerWidth / m_nTotalTime);
      }
    } else {
      //时长小于maxParts * 10秒的情况，单位等级固定使用10秒
      m_nBigCellTimeSpan = 10 * 1000; //10秒一个大格，每小格1秒
      m_nParts = parseInt(m_nTotalTime / m_nBigCellTimeSpan);
      fScrap = (m_nTotalTime % m_nBigCellTimeSpan) * (this.containerWidth / m_nTotalTime);
    }

    if (m_nParts == 1) {
      //判断是否达到最大级别
      this.maxScale = true;
    }

    //每个大格的宽度
    m_nBigCellWidth = (this.containerWidth - fScrap) / m_nParts;
    //从0时间点到m_nBeginTime时间点之间在大格中所占的宽度
    var mDistance = m_nBigCellWidth * ((m_nBeginTime % m_nBigCellTimeSpan) / m_nBigCellTimeSpan);
    //用于显示的每大格起始时间
    var m_nBigCellStartTime = parseInt(m_nBeginTime / m_nBigCellTimeSpan) * m_nBigCellTimeSpan;

    var m_nBigCellStart_x = 0; // 每个大格的起始 x 位置
    for(var i = 0; i <= m_nParts + (fScrap > 0 ? 1 : 0); i++) {
      m_nBigCellStart_x = m_nBigCellWidth * i - mDistance;
      this.drawBigCell(layer, m_nBigCellStart_x, m_nBigCellWidth, m_nBigCellStartTime);
      m_nBigCellStartTime += m_nBigCellTimeSpan;
    }

  };

  //绘制一个大格
  Class.prototype.drawBigCell = function(layer, start_x, width, start_time) {
    var that = this;
    //绘制时间
    var text = new Konva.Text({
      x: start_x + 2,
      y: that.containerHeight - that.mainTopBottomMargin - 14,
      text: $.msToHMS(start_time),
      fontSize: 14,
      fill: fontColor
    });
    layer.add(text);

    //绘制刻度
    //大格左右的两条线
    var line = new Konva.Line({
      points: [start_x, that.mainTopBottomMargin, start_x, that.containerHeight - that.mainTopBottomMargin],
      stroke: iconColor,
      strokeWidth: 1
    });
    layer.add(line);
    line = new Konva.Line({
      points: [start_x + width, that.mainTopBottomMargin, start_x + width, that.containerHeight - that.mainTopBottomMargin],
      stroke: iconColor,
      strokeWidth: 1
    });
    layer.add(line);

    //大格中线
    line = new Konva.Line({
      points: [start_x + width / 2, that.mainTopBottomMargin + 20, start_x + width / 2, that.containerHeight - that.mainTopBottomMargin - 20],
      stroke: iconColor,
      strokeWidth: 1
    });
    layer.add(line);

    //大格短线
    var smallCellWidth = (width / 10).toFixed(2);
    for(var i = 1; i <= 10; i++) {
      if (i === 5) {
        continue;
      }
      line = new Konva.Line({
        points: [start_x + smallCellWidth * i, that.mainTopBottomMargin + 35, start_x + smallCellWidth * i, that.containerHeight - that.mainTopBottomMargin - 35],
        stroke: iconColor,
        strokeWidth: 1
      });
      layer.add(line);
    }
  };

  //绘制游标
  Class.prototype.drawCursor = function(layer) {
    var currentTime = this.currentTime;
    if (currentTime > this.aTotalTime) {
      this.currentTime = this.aTotalTime;
      return;
    }
    $('#timeScale .current-time').html($.msToHMS(currentTime));

    if (this.arrow) {
      this.arrow.remove();
    }
    if (currentTime >= this.m_nBeginTime && currentTime <= this.m_nBeginTime + this.m_nTotalTime) {
      //游标在可视区域
      var arrow_x = (currentTime - this.m_nBeginTime) / this.m_nTotalTime * this.containerWidth;
      this.arrow = new Konva.Arrow({
        points: [arrow_x, 1, arrow_x, this.containerHeight - 1],
        pointerLength: 15,
        pointerWidth : 15,
        fill: cursorColor,
        stroke: cursorColor,
        strokeWidth: 2,
        pointerAtBeginning: true
      });

      layer.add(this.arrow);
    }
  };

  //绘制剪辑掉的片段
  Class.prototype.drawClipBlock = function(layer) {
    var that = this;
    var arr = this.clippedArr;
    var m_nEndTime = this.m_nBeginTime + this.m_nTotalTime;
    var rect, rectLeftLine, rectRightLine, rectLeftZoom, rectRightZoom, start_x, width;
    var mouse_start_x, mouse_end_x;
    if (this.konva.clipGroup) {
      //重置剪辑片段
      this.konva.clipGroup.removeChildren();
    }
    for (var i = 0, len = arr.length; i < len; i++) {
      if (arr[i].startTime >= this.m_nBeginTime && arr[i].endTime <= m_nEndTime) {
        //完全位于可视区域内
        start_x = (arr[i].startTime - this.m_nBeginTime) / this.m_nTotalTime * this.containerWidth;
        width = (arr[i].endTime - this.m_nBeginTime) / this.m_nTotalTime * this.containerWidth - start_x;
        //画矩形
        rect = new Konva.Rect({
          x: start_x,
          y: this.mainTopBottomMargin + 20,
          width: width,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          fill: 'rgba(255, 0, 0, 0.4)',
          name: 'clip_' + i
          // stroke: 'black',
          // strokeWidth: 2
        });
        //画左右边界线
        rectLeftLine = new Konva.Line({
          points: [start_x+6, this.mainTopBottomMargin+20, start_x, this.mainTopBottomMargin+20, start_x, this.containerHeight-this.mainTopBottomMargin-20, start_x+6, this.containerHeight-this.mainTopBottomMargin-20],
          stroke: 'red',
          strokeWidth: 2,
          name: 'clip_' + i
        });
        rectRightLine = new Konva.Line({
          points: [start_x+width-6, this.mainTopBottomMargin+20, start_x+width, this.mainTopBottomMargin+20, start_x+width, this.containerHeight-this.mainTopBottomMargin-20, start_x+width-6, this.containerHeight-this.mainTopBottomMargin-20],
          stroke: 'red',
          strokeWidth: 2,
          name: 'clip_' + i
        });
        //鼠标感应区域
        rectLeftZoom = new Konva.Rect({
          x: start_x,
          y: this.mainTopBottomMargin+20,
          width: 6,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          name: 'clip_' + i
        });
        rectRightZoom = new Konva.Rect({
          x: start_x+width-6,
          y: this.mainTopBottomMargin+20,
          width: 6,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          name: 'clip_' + i
        });
      } else if (arr[i].startTime < this.m_nBeginTime) {
        //只有后边的一部分位于可视区域内
        width = (arr[i].endTime - this.m_nBeginTime) / this.m_nTotalTime * this.containerWidth;
        //画矩形
        rect = new Konva.Rect({
          x: 0,
          y: this.mainTopBottomMargin + 20,
          width: width,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          fill: 'rgba(255, 0, 0, 0.4)',
          name: 'clip_' + i
          // stroke: 'black',
          // strokeWidth: 2
        });
        //画右边的边界线
        rectRightLine = new Konva.Line({
          points: [width-6, this.mainTopBottomMargin+20, width, this.mainTopBottomMargin+20, width, this.containerHeight-this.mainTopBottomMargin-20, width-6, this.containerHeight-this.mainTopBottomMargin-20],
          stroke: 'red',
          strokeWidth: 2,
          name: 'clip_' + i
        });
        rectRightZoom = new Konva.Rect({
          x: width-6,
          y: this.mainTopBottomMargin+20,
          width: 6,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          name: 'clip_' + i
        });
      } else if (arr[i].endTime > m_nEndTime) {
        //只有前边的一部分位于可视区域内
        start_x = (arr[i].startTime - this.m_nBeginTime) / this.m_nTotalTime * this.containerWidth;
        width = this.containerWidth - start_x;
        //画矩形
        rect = new Konva.Rect({
          x: start_x,
          y: this.mainTopBottomMargin + 20,
          width: width,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          fill: 'rgba(255, 0, 0, 0.4)',
          name: 'clip_' + i
          // stroke: 'black',
          // strokeWidth: 2
        });
        //画左边的边界线
        rectLeftLine = new Konva.Line({
          points: [start_x+6, this.mainTopBottomMargin+20, start_x, this.mainTopBottomMargin+20, start_x, this.containerHeight-this.mainTopBottomMargin-20, start_x+6, this.containerHeight-this.mainTopBottomMargin-20],
          stroke: 'red',
          strokeWidth: 2,
          name: 'clip_' + i
        });
        //鼠标感应区域
        rectLeftZoom = new Konva.Rect({
          x: start_x,
          y: this.mainTopBottomMargin+20,
          width: 6,
          height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
          name: 'clip_' + i
        });
      }
      //单击选中相应的剪辑片段
      rect.on('click', function(e) {
        var className = this.getName();
        // var ele = that.konva.layer.find('.' + className);
        if (!this.hasOwnProperty('checked')) {
          this.checked = false;
        }
        if (this.checked === false) {
          this.checked = true;
          this.setAttr('fill', 'rgba(100, 0, 0, 0.6)');
          that.konva.delClipEle.push('.' + className);
        } else if (this.checked === true) {
          this.checked = false;
          this.setAttr('fill', 'rgba(255, 0, 0, 0.4)');
          that.konva.delClipEle.splice(that.konva.delClipEle.indexOf('.' + className), 1);
        }
        that.konva.layer.draw();
      });
      this.konva.clipGroup.add(rect);

      if (rectLeftLine) {
        //左边边界区域的鼠标感应事件
        rectLeftZoom.on('mousedown', function(e) {
          var name = this.getName();
          mouse_start_x = e.evt.clientX;
          function mousemove(e) {
            mouse_end_x = e.clientX;
            var timeDiff = Math.round((mouse_end_x - mouse_start_x) / that.containerWidth * that.m_nTotalTime);
            var index = name.split('_')[1];
            if (timeDiff + that.clippedArr[index].startTime >= that.clippedArr[index].endTime) {
              that.clippedArr[index].startTime = that.clippedArr[index].endTime;
            } else {
              that.clippedArr[index].startTime += timeDiff;
            }
            that.drawClipBlock(that.konva.layer);
            that.konva.layer.batchDraw();
            mouse_start_x = mouse_end_x;
          }
          document.onmousemove = mousemove;
        });
        rectLeftZoom.on('mouseover', function() {
          document.body.style.cursor = 'e-resize';
        });
        rectLeftZoom.on('mouseout', function() {
          document.body.style.cursor = 'default';
        });
        this.konva.clipGroup.add(rectLeftLine, rectLeftZoom);
      }
      if (rectRightLine) {
        //右边边界区域的鼠标感应事件
        rectRightZoom.on('mouseover', function() {
          document.body.style.cursor = 'e-resize';
        });
        rectRightZoom.on('mouseout', function() {
          document.body.style.cursor = 'default';
        });
        rectRightZoom.on('mousedown', function(e) {
          var name = this.getName();
          mouse_start_x = e.evt.clientX;
          function mousemove(e) {
            mouse_end_x = e.clientX;
            var timeDiff = Math.round((mouse_end_x - mouse_start_x) / that.containerWidth * that.m_nTotalTime);
            var index = name.split('_')[1];
            if (timeDiff + that.clippedArr[index].endTime <= that.clippedArr[index].startTime) {
              that.clippedArr[index].endTime = that.clippedArr[index].startTime;
            } else {
              that.clippedArr[index].endTime += timeDiff;
            }
            that.drawClipBlock(that.konva.layer);
            that.konva.layer.batchDraw();
            mouse_start_x = mouse_end_x;
          }
          document.onmousemove = mousemove;
        });
        this.konva.clipGroup.add(rectRightLine, rectRightZoom);
      }
    }
    layer.add(this.konva.clipGroup);
  };

  //绘制无录像的状态展示
  Class.prototype.drawNoVideoBlock = function(layer) {
    var sectionArr = this.config.sectionArr;
    var rect, start_x, width, text;
    var m_nBeginTime = this.m_nBeginTime,
    m_nEndTime = this.m_nBeginTime + this.m_nTotalTime;
    m_nTotalTime = this.m_nTotalTime;
    var section_start = 0, section_end;
    for (var i = 0, len = sectionArr.length; i < len; i++) {
      //片段结束时间
      section_end = section_start + sectionArr[i].duration;
      if (!sectionArr[i].status) {
        //当该段时间无录像时
        if (section_start >= m_nBeginTime && section_end <= m_nEndTime) {
          //完全在可视范围内
          start_x = (section_start - m_nBeginTime) / m_nTotalTime * this.containerWidth;
          width = sectionArr[i].duration / m_nTotalTime * this.containerWidth;
          rect = new Konva.Rect({
            x: start_x,
            y:  this.mainTopBottomMargin + 20,
            width: width,
            height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
            fill: 'rgba(10, 10, 10, 0.8)'
          })
        } else if (section_start < m_nBeginTime && section_end > m_nBeginTime && section_end <= m_nEndTime) {
          //后半段在可视范围内
          start_x = 0;
          width = (section_end - m_nBeginTime) / m_nTotalTime * this.containerWidth;
          rect = new Konva.Rect({
            x: start_x,
            y: this.mainTopBottomMargin + 20,
            width: width,
            height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
            fill: 'rgba(10, 10, 10, 0.8)'
          });
        } else if (section_start >= m_nBeginTime && section_start < m_nEndTime && section_end > m_nEndTime) {
          //前半段在可视范围内
          start_x = (section_start - m_nBeginTime) / m_nTotalTime * this.containerWidth;
          width = this.containerWidth - start_x;
          rect = new Konva.Rect({
            x: start_x,
            y: this.mainTopBottomMargin + 20,
            width: width,
            height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
            fill: 'rgba(10, 10, 10, 0.8)'
          });
        } else if (section_start < m_nBeginTime && section_end > m_nEndTime) {
          //只有中间一部分在可视范围内
          start_x = 0;
          width = this.containerWidth;
          rect = new Konva.Rect({
            x: start_x,
            y: this.mainTopBottomMargin + 20,
            width: width,
            height: this.containerHeight - this.mainTopBottomMargin * 2 - 40,
            fill: 'rgba(10, 10, 10, 0.8)'
          });
        }
        if (rect) {
          layer.add(rect);
        }
        if (width > 50) {
          //增加文字提示
          text = new Konva.Text({
            x: start_x + width / 2 - 25,
            y: this.containerHeight / 2 - 8,
            text: '无录像',
            fontSize: 16,
            fill: fontColor
          });
          layer.add(text);
        }
      }
      //下个片段开始时间
      section_start = section_end;
    }
  };

  //绘制索引
  Class.prototype.drawIndex = function(layer) {
    var that = this;
    var m_nEndTime = this.m_nBeginTime + this.m_nTotalTime;
    var line, start_x;
    if (this.konva.indexGroup) {
      this.konva.indexGroup.removeChildren();
    }
    for (var i = 0, len = this.indexArr.length; i < len; i++) {
      if (this.indexArr[i] >= this.m_nBeginTime && this.indexArr[i] <= m_nEndTime) {
        //位于可视区域内
        start_x = (this.indexArr[i] - this.m_nBeginTime) / this.m_nTotalTime * this.containerWidth;
        line = new Konva.Line({
          points: [start_x, this.mainTopBottomMargin + 20, start_x, this.containerHeight - this.mainTopBottomMargin - 20],
          stroke: '#ff6600',
          strokeWidth: 4,
          name: 'index_' + i
        });
        line.on('click', function() {
          //索引点击事件
          var name = this.getName();
          if (!this.hasOwnProperty('checked')) {
            this.checked = false;
          }
          if (this.checked) {
            this.setAttr('stroke', '#ff6600');
            this.checked = false;
            that.konva.delIndexEle.splice(that.konva.delIndexEle.indexOf('.' + name), 1);
          } else {
            this.setAttr('stroke', '#ff9900');
            this.checked = true;
            that.konva.delIndexEle.push('.' + name);
          }
          layer.draw();
        });
        this.konva.indexGroup.add(line);
      }
    }
    layer.add(this.konva.indexGroup);
  };

  //绝对时间转相对时间
  Class.prototype.absToRel = function(time) {
    var sectionArr = this.config.sectionArr;
    var section_start = 0, section_end;
    for (var i = 0, len = sectionArr.length; i < len; i++) {
      section_end = section_start + sectionArr[i].duration;
      if (time >= section_start && time <= section_end) {
        return {
          id: sectionArr[i].id,
          time: time - section_start,
          absTime: time
        };
      }
      section_start = section_end;
    }
  };

  //相对时间转绝对时间
  Class.prototype.relToAbs = function(id, time) {
    var sectionArr = this.config.sectionArr;
    var section_start = 0;
    for (var i = 0, len = sectionArr.length; i < len; i++) {
      if(id == sectionArr[i].id) {
        return section_start + time;
      }
      section_start += sectionArr[i].duration;
    }
  };

  //插件内部事件初始化
  Class.prototype.eventInit = function() {
    var that = this;
    //播放按钮
    $('#timescale-play').on('click', function(e) {
      var $iconfont = $(e.currentTarget).find('.iconfont');
      if ($iconfont.hasClass('icon-bofang')) {
        $('#timescale-preview').find('.iconfont').removeClass('icon-zanting').addClass('icon-yulan');
        $iconfont.removeClass('icon-bofang');
        $iconfont.addClass('icon-zanting');
        that.emit('play');
      } else {
        $iconfont.removeClass('icon-zanting');
        $iconfont.addClass('icon-bofang');
        that.emit('pause');
      }
    });

    //预览按钮
    $('#timescale-preview').on('click', function(e) {
      var clipsArr = [], clippedArr = [];
      var $iconfont = $(e.currentTarget).find('.iconfont');
      if ($iconfont.hasClass('icon-yulan')) {
        $('#timescale-play').find('.iconfont').removeClass('icon-zanting').addClass('icon-bofang');
        $iconfont.removeClass('icon-yulan');
        $iconfont.addClass('icon-zanting');
        clipsArr = that.findVideoSection(that.clippedReverse(that.clippedArr));
        clippedArr = that.findVideoSection(that.clippedArr);
        that.emit('previewStart', clipsArr, clippedArr);
      } else {
        $iconfont.removeClass('icon-zanting');
        $iconfont.addClass('icon-yulan');
        that.emit('previewStop');
      }
    });

    //放大按钮
    $('#timescale-zoomIn').on('click', function(e) {
      if (that.maxScale) {
        return;
      }
      that.scale *= 2;
      that.m_nTotalTime = that.aTotalTime / that.scale;

      //将游标尽可能的居中
      if (that.currentTime >= that.m_nTotalTime / 2 && that.aTotalTime - that.currentTime >= that.m_nTotalTime / 2) {
        //如果条件允许，则将游标置于最中间
        that.m_nBeginTime = that.currentTime - that.m_nTotalTime / 2;
      } else if (that.currentTime < that.m_nTotalTime / 2) {
        that.m_nBeginTime = 0;
      } else if (that.aTotalTime - that.currentTime < that.m_nTotalTime / 2) {
        that.m_nBeginTime = that.aTotalTime - that.m_nTotalTime;
      }

      //重置刻度层
      that.konva.layer.removeChildren();
      that.drawLineF(that.konva.layer);
      if(that.config.showSectionStatus)that.drawNoVideoBlock(that.konva.layer);
      that.drawIndex(that.konva.layer);
      that.drawCursor(that.konva.layer);
      that.drawClipBlock(that.konva.layer);
      that.konva.layer.draw();

      //改变滚动条的宽度和位置
      var startPosition = that.m_nBeginTime / that.aTotalTime * 100;
      var width = that.m_nTotalTime / that.aTotalTime * 100;
      $('#timescale-scroll-bar').attr('style', 'width:'+width+'%;left:'+startPosition+'%');
    });

    //缩小按钮
    $('#timescale-zoomOut').on('click', function(e) {
      that.scale /= 2;
      if (that.scale < 1) {
        that.scale = 1;
        return;
      }
      that.maxScale = false;
      that.m_nTotalTime = that.aTotalTime / that.scale;

      //将游标尽可能的居中
      if (that.currentTime >= that.m_nTotalTime / 2 && that.aTotalTime - that.currentTime >= that.m_nTotalTime / 2) {
        //如果条件允许，则将游标置于最中间
        that.m_nBeginTime = that.currentTime - that.m_nTotalTime / 2;
      } else if (that.currentTime < that.m_nTotalTime / 2) {
        that.m_nBeginTime = 0;
      } else if (that.aTotalTime - that.currentTime < that.m_nTotalTime / 2) {
        that.m_nBeginTime = that.aTotalTime - that.m_nTotalTime;
      }
      //重置刻度层
      that.konva.layer.removeChildren();
      that.drawLineF(that.konva.layer);
      if(that.config.showSectionStatus)that.drawNoVideoBlock(that.konva.layer);
      that.drawIndex(that.konva.layer);
      that.drawCursor(that.konva.layer);
      that.drawClipBlock(that.konva.layer);
      that.konva.layer.draw();

      //改变滚动条的宽度和位置
      var startPosition = that.m_nBeginTime / that.aTotalTime * 100;
      var width = that.m_nTotalTime / that.aTotalTime * 100;
      $('#timescale-scroll-bar').attr('style', 'width:'+width+'%;left:'+startPosition+'%');
    });

    //滚动条拖拽事件
    var old_x = 0;
    var mouse_start_x = 0;
    function mousemove(e) {
      var scroll_left = (e.clientX - mouse_start_x + old_x) / that.containerWidth * 100;
      var self_width = parseFloat(ready.getStyle($('#timescale-scroll-bar')[0], 'width'));

      //边界碰撞检测
      if (scroll_left <= 0) {
        scroll_left = 0;
      } else if (scroll_left >= (100 - self_width / that.containerWidth * 100)) {
        scroll_left = 100 - self_width / that.containerWidth * 100;
      }

      //调整时间轴的开始时间
      that.m_nBeginTime = that.aTotalTime * scroll_left / 100;
      that.konva.layer.removeChildren();
      that.drawLineF(that.konva.layer);
      if(that.config.showSectionStatus)that.drawNoVideoBlock(that.konva.layer);
      that.drawIndex(that.konva.layer);
      that.drawCursor(that.konva.layer);
      that.drawClipBlock(that.konva.layer);
      that.konva.layer.batchDraw();
      $('#timescale-scroll-bar').css('left', scroll_left + '%');
    }
    $('#timescale-scroll-bar').on('mousedown', function(e) {
      mouse_start_x = e.clientX;
      old_x = parseFloat(ready.getStyle($('#timescale-scroll-bar')[0], 'left'));
      // $(document).on('mousemove', mousemove);
      // document.onmousemove = $.throttle(mousemove, 30);
      document.onmousemove = mousemove;
    });
    $(document).on('mouseup', function(e) {
      // $(this).off('mousemove', mousemove);
      document.onmousemove = null;
    });

    //入点点击事件
    $('#timescale-clip-start').on('click', function(e) {
      that.clipStart();
      that.drawClipBlock(that.konva.layer);
      that.konva.layer.draw();
    });

    //出点点击事件
    $('#timescale-clip-end').on('click', function(e) {
      that.clipEnd();
      that.drawClipBlock(that.konva.layer);
      that.konva.layer.draw();
    });

    //删除选中剪辑片段
    $('#timescale-del').on('click', function() {
      var index = 0;
      var delClipArr = [], delIndexArr = [];
      for (var i = 0, len = that.konva.delClipEle.length; i < len; i++) {
        index = that.konva.delClipEle[i].split('_')[1];
        delClipArr.push(Number(index));
      }
      for (var i = 0, len = that.konva.delIndexEle.length; i < len; i++) {
        index = that.konva.delIndexEle[i].split('_')[1];
        that.emit('delIndex', that.absToRel(that.indexArr[index]));
        delIndexArr.push(Number(index));
      }
      if (that.konva.delClipEle.lenght > 0) {
        that.clippedArr = that.clippedArr.filter(function(currentValue, index) {
          return delClipArr.indexOf(index) === -1;
        });
        that.drawClipBlock(that.konva.layer);
      }
      if (that.konva.delIndexEle.length > 0) {
        that.indexArr = that.indexArr.filter(function(currentValue, index) {
          return delIndexArr.indexOf(index) === -1;
        });
        that.drawIndex(that.konva.layer);
      }
      that.konva.layer.draw();
      that.konva.delClipEle = [];
      that.konva.delIndexEle = [];
    });

    //剪辑按钮事件
    $('#timescale-clip').on('click', function() {
      var clipsArr = [], clippedArr = [];
      clipsArr = that.findVideoSection(that.clippedReverse(that.clippedArr));
      clippedArr = that.findVideoSection(that.clippedArr);
      
      that.emit('clip', clipsArr, clippedArr);
    });

    //创建索引事件
    $('#timescale-index').on('click', function() {
      var currentTime = that.currentTime;
      if (that.indexArr.indexOf(currentTime) > -1) {
        return;
      }
      that.indexArr.push(currentTime);
      that.drawIndex(that.konva.layer);
      that.konva.layer.draw();

      that.emit('createIndex', that.absToRel(currentTime));
    });
  };

  //找出剪辑片段中包含的视频片段
  //返回一个包含具体视频片段的数组
  Class.prototype.findVideoSection = function(arr) {
    var that = this;
    var resultArr = [], clipsArr = arr, sectionArr = JSON.parse(JSON.stringify(that.config.sectionArr));
    var clips_len = clipsArr.length, section_len = sectionArr.length;
    for (var i = 0; i < clips_len; i++) {
      for (var j = 0; j < section_len; j++) {
        if (j === 0) {
          sectionArr[j].startTime = 0;
          sectionArr[j].endTime = sectionArr[j].duration
        } else {
          sectionArr[j].startTime = sectionArr[j-1].endTime;
          sectionArr[j].endTime = sectionArr[j].startTime + sectionArr[j].duration;
        }
        if (clipsArr[i].startTime >= sectionArr[j].startTime && clipsArr[i].endTime <= sectionArr[j].endTime) {
          //片段位于当前视频上
          resultArr.push({
            section: [{
              id: sectionArr[j].id,
              startTime: clipsArr[i].startTime - sectionArr[j].startTime,
              endTime: clipsArr[i].endTime - sectionArr[j].startTime
            }],
            allStartTime: clipsArr[i].startTime,
            allEndTime: clipsArr[i].endTime
          });
          break;
        } else if (clipsArr[i].startTime >= sectionArr[j].startTime && clipsArr[i].endTime > sectionArr[j].endTime && sectionArr[j].endTime > clipsArr[i].startTime) {
          //片段的前一部分在当前视频上
          resultArr.push({
            section: [{
              id: sectionArr[j].id,
              startTime: clipsArr[i].startTime - sectionArr[j].startTime,
              endTime: sectionArr[j].duration
            }],
            allStartTime: clipsArr[i].startTime,
            allEndTime: clipsArr[i].endTime
          });
        } else if (clipsArr[i].startTime < sectionArr[j].startTime && clipsArr[i].endTime <= sectionArr[j].endTime) {
          //片段的后一部分在当前视频上
          resultArr[resultArr.length - 1].section.push({
            id: sectionArr[j].id,
            startTime: 0,
            endTime: clipsArr[i].endTime - sectionArr[j].startTime
          });
          break;
        } else if (clipsArr[i].startTime < sectionArr[j].startTime && clipsArr[i].endTime > sectionArr[j].endTime) {
          //片段的中间一部分在当前视频上
          resultArr[resultArr.length - 1].section.push({
            id: sectionArr[j].id,
            startTime: 0,
            endTime: sectionArr[j].duration
          })
        }
      }
    }
    return resultArr;
  };

  //剪辑片段反选
  Class.prototype.clippedReverse = function(clippedArr) {
    var clipped_len = clippedArr.length;
    var clipsArr = [];
    for (var i = 0; i < clipped_len; i++) {
      if (i === 0) {
        if (clippedArr[i].startTime !== 0) {
          //剪辑片段位于最开头
          clipsArr.push({
            startTime: 0,
            endTime: clippedArr[i].startTime
          });
        }
      }
      if (i === clipped_len - 1) {
        //剪辑片段位于最末尾
        if (clippedArr[i].endTime !== this.aTotalTime) {
          clipsArr.push({
            startTime: clippedArr[i].endTime,
            endTime: this.aTotalTime
          });
        }
      }
      if (i < clipped_len - 1) {
        clipsArr.push({
          startTime: clippedArr[i].endTime,
          endTime: clippedArr[i+1].startTime
        });
      }
    }
    return clipsArr;
  };

  //剪辑开始的点
  Class.prototype.clipStart = function() {
    var currentTime = this.currentTime;
    for (var i = 0, len = this.clippedArr.length; i < len; i++) {
      if (currentTime < this.clippedArr[i].startTime) {
        //当前时间点位于某个剪辑片段前
        this.clippedArr.splice(i, 0, {startTime: currentTime, endTime: this.clippedArr[i].startTime});
        break;
      } else if (currentTime >= this.clippedArr[i].startTime && currentTime <= this.clippedArr[i].endTime) {
        //当前时间点位于某个剪辑片段上
        this.clippedArr[i].startTime = currentTime;
        break;
      }
    }
    if (i == len) {
      //当前时间点位于所有剪辑片段之后，
      this.clippedArr.push({
        startTime: currentTime,
        endTime: this.aTotalTime
      });
    }
  };

  //剪辑结束的点
  Class.prototype.clipEnd = function() {
    var currentTime = this.currentTime;
    for (var i = 0, len = this.clippedArr.length; i < len; i++) {
      if (currentTime < this.clippedArr[i].startTime) {
        //当前时间点位于某个剪辑片段前
        if (i === 0) {
          //在第一个剪辑片段前
          this.clippedArr.unshift({
            startTime: 0,
            endTime: currentTime
          });
        } else {
          this.clippedArr.splice(i, 0, {startTime: this.clippedArr[i-1].endTime, endTime: currentTime});
        }
        break;
      } else if (currentTime >= this.clippedArr[i].startTime && currentTime <= this.clippedArr[i].endTime) {
        //当前时间点位于某个剪辑片段上
        this.clippedArr[i].endTime = currentTime;
        break;
      }
    }
    if (i === len) {
      this.clippedArr.push({
        startTime: this.clippedArr[len - 1].endTime,
        endTime: currentTime
      });
    }
  }

  //触发对应的事件
  Class.prototype.emit = function(event) {
    var argu = [];
    for (var i = 1, len = arguments.length; i < len; i++) {
      argu.push(arguments[i]);
    }
    if (this.eventListObj.hasOwnProperty(event)) {
      for (var i = 0, len = this.eventListObj[event].length; i < len; i++) {
        this.eventListObj[event][i].apply(null, argu);
      }
    }
  };
  
  //等待插件初始化完毕
  Class.prototype.wait = function(fun) {
    var that = this;
    (function poll() {
      that.konva.layer ? fun() : setTimeout(poll, 100);
    })();
  }
  /******** 插件暴露在外的方法 start ***********/
  //重新加载时间轴
  Class.prototype.reload = function(sectionArr, clipsArr) {
    var that = this;
    this.wait(function() {
      that.clippedArr = [];
      that.indexArr = [];
      that.konva.layer.removeChildren();
      that.konva.staticLayer.removeChildren();
      that.konva.delClipEle = [];
      that.konva.delIndexEle = [];
      that.scale = 1;
      $('#timescale-scroll-bar').css('width', '100%').css('left', '0');
      $('#timescale-play').find('.iconfont').removeClass('icon-zanting').addClass('icon-bofang');
      $('#timescale-preview').find('.iconfont').removeClass('icon-zanting').addClass('icon-yulan');
      that.timelineLoad(sectionArr, clipsArr);
    });
  }
  //设置播放进度
  Class.prototype.seekTo = function(id, time) {
    var that = this;
    this.wait(function() {
      var total = 0;
      for(var i = 0, len = sectionArr.length; i < len; i++) {
        if (id === sectionArr[i].id) {
          total += time;
          break;
        } else {
          total += sectionArr[i].duration;
        }
      }
      that.currentTime = total;
      that.drawCursor(that.konva.layer);
      that.konva.layer.batchDraw();
    })
  };

  //播放
  Class.prototype.play = function() {
    this.wait(function() {
      $('#timescale-play .iconfont').removeClass('icon-bofang').addClass('icon-zanting');
    });
  };

  //暂停
  Class.prototype.pause = function() {
    this.wait(function() {
      $('#timescale-play .iconfont').removeClass('icon-zanting').addClass('icon-bofang');
    });
  };

  //添加索引
  Class.prototype.createIndex = function(id, time) {
    var that = this;
    this.wait(function() {
      that.indexArr.push(that.relToAbs(id, time));
      that.drawIndex(that.konva.layer);
      that.konva.layer.draw();
    });
  };


  //监听插件的事件
  Class.prototype.on = function(event, fun) {
    if (this.eventListObj.hasOwnProperty(event)) {
      this.eventListObj[event].push(fun);
    } else {
      this.eventListObj[event] = [fun];
    }
  };

  //移除插件的事件监听
  Class.prototype.off = function(event, fun) {
    if (this.eventListObj.hasOwnProperty(event)) {
      for (var i = 0, len = this.eventListObj[event].length; i < len; i++) {
        if (this.eventListObj[event][i] === fun) {
          this.eventListObj[event].splice(i, 1);
        }
      }
    }
  }

  /******** 插件暴露在外的方法 end ***********/

  /********** 插件暴露在外的事件回调 start ************/


  /********** 插件暴露在外的事件回调 end ************/

  Class.prototype.init = function() {
    var that = this;
    that.frameInit();
    that.timelineLoad(that.config.sectionArr, that.config.clipsArr);
    that.eventInit();
  };

  /** 
   * @method timelineLoad
   * @desc 用来初始化视频剪辑控件
   * @param {string} sectionArr - [{id: 1, duration: 100000}]
   * 备注：此参数为所有视频片段的描述信息，id为视频片段的唯一标识，duration为每个片段的时长(毫秒)
   * @param {string} clipsArr - [{startTime: 0, endTime: 2000}, {startTime: 4000, endTime: 100000}]
   * 备注：单位为毫秒ms已保存的片段描述信息，startTime为拼合后起始点的时长，endTime为拼合后终止点的时长
   * @returns void
   */
  Class.prototype.timelineLoad = function(sectionArr, clipsArr) {
    var that = this;
    var ele = document.getElementById('timescale-main');
    var width = that.containerWidth = parseFloat(ready.getStyle(ele, 'width'));
    var height = that.containerHeight = parseFloat(ready.getStyle(ele, 'height'));
    var totalTime = 0; 

    //计算总时间
    for (var i = 0, len = sectionArr.length; i < len; i++) {
      totalTime += sectionArr[i].duration;
    }
    that.aTotalTime = totalTime;
    $('.timescale .total-time').html($.msToHMS(totalTime));

    //计算被剪切掉的片段
    if (Array.isArray(clipsArr)) {
      for (var i = 0, len = clipsArr.length - 1; i < len; i++) {
        if (clipsArr[i].endTime < clipsArr[i+1].startTime) {
          that.clippedArr.push({
            startTime: clipsArr[i].endTime,
            endTime: clipsArr[i+1].startTime
          });
        }
      }
      if (clipsArr.length == 1) {
        if (clipsArr[0].startTime > 0) {
          that.clippedArr.push({
            startTime: 0,
            endTime: clipsArr[0].startTime
          });
        } else {
          that.clippedArr.push({
            startTime: clipsArr[0].endTime,
            endTime: totalTime
          });
        }
      }
    }

    //背景颜色
    var rect = new Konva.Rect({
      x: 0,
      y: that.mainTopBottomMargin,
      width: width,
      height: height - that.mainTopBottomMargin * 2,
      fill: backgroundColor
    });
    // add the shape to the layer
    that.konva.staticLayer.add(rect);

    //中间的横线
    var line = new Konva.Line({
      points: [0, height/2 - 2, width, height/2 - 2],
      stroke: iconColor,
      strokeWidth: 4
    });
    that.konva.staticLayer.add(line);
    that.konva.staticLayer.draw();


    that.m_nTotalTime = that.aTotalTime;
    that.drawLineF(that.konva.layer);
    if(that.config.showSectionStatus)that.drawNoVideoBlock(that.konva.layer);
    that.drawIndex(that.konva.layer);
    that.drawCursor(that.konva.layer);

    // that.clippedArr = [{startTime: 5000, endTime: 10000}, {startTime: 60000, endTime: 150000}];
    that.drawClipBlock(that.konva.layer);

    that.konva.layer.draw();
  };

  /** 
   * @method frameInit
   * @desc 时间轴框架初始化
   */
  Class.prototype.frameInit = function() {
    var that = this;
    var ele = document.getElementById(that.config.ele);
    var operation = "<div class='timescale-operation'>\
      <div class='timescale-timeshow'>\
        <span>当前：<span class='current-time'>02:00:00</span></span>\
        <span>总时长：<span class='total-time'>00:00:00</span></span>\
      </div>\
      <div class='timescale-operation-group'>\
        <span title='播放' id='timescale-play'><i class='iconfont icon-bofang'></i></span>"
        +(that.config.clipEnable ? "<span title='预览' id='timescale-preview'><i class='iconfont icon-yulan'></i></span>" : "") + 
      "</div>"
      + (that.config.clipEnable || that.config.indexEnable ? 
      "<div class='timescale-operation-group'>"
        + (that.config.clipEnable ?
        "<span title='入点' id='timescale-clip-start'><i class='iconfont icon-rudian'></i></span>\
        <span title='出点' id='timescale-clip-end'><i class='iconfont icon-chudian'></i></span>\
        <span title='剪辑' id='timescale-clip'><i class='iconfont icon-jianqie'></i></span>" : "") 
        +(that.config.indexEnable ? "<span title='创建索引' id='timescale-index'><i class='iconfont icon-I'></i></span>" : "") +
        "<span title='删除' id='timescale-del'><i class='iconfont icon-delete'></i></span>\
      </div>" : "") +
      "<div class='timescale-operation-group'>\
        <span title='放大' id='timescale-zoomIn'><i class='iconfont icon-fangda'></i></span>\
        <span title='缩小' id='timescale-zoomOut'><i class='iconfont icon-suoxiao'></i></span>\
      </div>\
    </div>";
    var main = "<div id='timescale-main'></div>";
    var foot = "<div id='timescale-scroll'>\
      <div id='timescale-scroll-bar'></div>\
      <div class='timescale-scroll-draggerRail'></div>\
    </div>"
    var totalSrc = operation + main + foot;

    //自定义颜色导入
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = ".timescale{border-color:"+iconColor+"}.timescale-operation{background-color:"+backgroundColor+"}.timescale-operation .iconfont{color:"+iconColor+"}.timescale-operation .timescale-timeshow>span{color:"+fontColor+"}.timescale-operation .timescale-timeshow .current-time,.timescale-operation .timescale-timeshow .total-time{border-color:"+iconColor+";-webkit-box-shadow: 0 0 5px 1px "+iconColor+" inset;-moz-box-shadow: 0 0 5px 1px "+iconColor+" inset;box-shadow: 0 0 5px 1px "+iconColor+" inset;}.timescale-operation .timescale-operation-group{border-color:"+iconColor+"}#timescale-scroll-bar{background-color:"+iconColor+"}#timescale-main{border-color:"+iconColor+"}.timescale-operation .timescale-operation-group span:hover{-webkit-box-shadow: 0 0 10px 1px "+iconColor+" inset;-moz-box-shadow: 0 0 10px 1px "+iconColor+" inset;box-shadow: 0 0 10px 1px "+iconColor+" inset;}";
    $(document.head).append(style);

    $(ele).addClass('timescale');
    $(ele).html(totalSrc);

    //初始化画布
    var canvas = document.getElementById('timescale-main');
    var width = that.containerWidth = parseFloat(ready.getStyle(canvas, 'width'));
    var height = that.containerHeight = parseFloat(ready.getStyle(canvas, 'height'));
    that.konva.stage = new Konva.Stage({
      container: 'timescale-main',
      width: width,
      height: height
    });
    //动态变化的图层
    that.konva.layer = new Konva.Layer();
    //初始化不再改变的图层
    that.konva.staticLayer = new Konva.Layer();
    that.konva.staticLayer.on('click', function(e) {
      var clickTime = (e.evt.layerX / that.containerWidth * that.m_nTotalTime + that.m_nBeginTime) / 1000;
      that.currentTime = Math.round(clickTime) * 1000;
      that.drawCursor(that.konva.layer);
      that.konva.layer.draw();
      that.emit('seekTo', that.absToRel(that.currentTime));
    });

    //初始化剪辑片段组
    this.konva.clipGroup = new Konva.Group();
    //初始化索引组
    this.konva.indexGroup = new Konva.Group();
    that.konva.stage.add(that.konva.staticLayer, that.konva.layer);
  };

  timescale.render = function(options) {
    var inst = new Class(options);
    return thisTimeScale.call(inst);
  };

  (typeof define === 'function' && define.amd) ? define(function(){ //requirejs加载
    return timescale;
  }) : function(){ //普通script标签加载
    timescale.ready();
    window.timescale = timescale;
  }()
})();