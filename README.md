# 视频播放时间轴插件

>作者：a-ke

## 安装说明
1. 使用script引入   
将此文件夹放到静态目录下，在html文件中引入TimeScale.js即可。例如
```html
<script type="text/javascript" src="/static/plugin/timescale/TimeScale.js"></script>
```
2. import 引入   
需要提前引入timescale.css和konva.min.js两个文件。实例：
```javascript
import 'timescale/css/timescale.css'
import 'timescale/js/konva.min.js'
import 'timescale/TimeScale.js'
```

## 使用说明
1. 首先在html中设置一个div，如下：
```html
<!-- 推荐容器高度为200px -->
<div id='timescale'></div>
```
2. 使用<mark>render</mark>函数初始化
```javascript
var sectionArr = [{
  id: 1, //视频id,唯一标识
  duration: 312000, //当前视频的时长
  // status: true //表示该视频是否存在
}, {
  id: 2,
  duration: 300000,
  // status: false
}, {
  id: 3,
  duration: 10000,
  // status: true
}];
var clipsArr = [{
  startTime: 0,  //剪辑片段的开始时间
  endTime: 5000  //剪辑片段的结束时间
}, {
  startTime: 10000, 
  endTime: 60000
}, {
  startTime: 150000, 
  endTime: 612000
}];
var timeLine = timescale.render({
  ele: 'timescale', //插件要渲染的元素的id
  sectionArr: sectionArr, //视频片段信息
  clipsArr: clipsArr, //视频剪辑片段信息
  // showSectionStatus: true, //是否显示视频的状态
  // indexEnable: true, //是否开启索引功能
  // clipEnable: true, //是否开启剪辑功能
  // backgroundColor: '#a0a0a0', //插件背景颜色（可选）
  // fontColor: '#333', //插件字体颜色（可选）
  // iconColor: '#333', //插件图标颜色和刻度颜色（可选）
  // cursorColor: '#FF6600' //插件游标的颜色（可选）
});
```
### render函数中配置项说明
属性名 | 说明 | 类型 | 默认值 | 必选
--- | --- | --- | :-: | --- |
ele | 插件要渲染的元素id | string | - | 是
sectionArr | 视频片段信息(格式要求见已上的使用例子) | array | - | 是
clipsArr | 视频剪辑片段信息(格式要求见已上的使用例子) | array | - | 否
showSectionStatus | 是否显示视频的状态(当为true时，sectionArr中每个对象必须有一个status属性) | boolean | false | 否
indexEnable | 是否开启索引功能 | boolean | false | 否
clipEnabel | 是否开启剪辑功能 | boolean | false | 否
backgroundColor | 插件背景颜色 | string | '#141F39' | 否
fontColor | 插件上字体颜色 | string | '#fff' | 否
iconColor | 插件上图标颜色和刻度颜色 | string | '#097DB1' | 否
cursorColor | 插件游标的颜色 | string | '#FF6600' | 否


3. 初始化完成后，插件效果如下：   

![示例图片](./image/demo.png)

## 插件方法说明
1. timeLine.play()   
控制插件工具条上的播放按钮切换为播放状态
2. timeLine.pause()   
控制插件工具条上的暂停按钮切换为暂停状态
3. timeLine.seekTo(time)   
控制游标移动到指定的时间，time为要跳转到的时间，单位为毫秒
4. timeLine.createIndex(id, time)      
创建索引。id为视频的唯一标识，time 为要创建的索引时间。
5. timeLine.on(event, callback)   
注册相应的监听事件
6. timeLine.off(event, callback)   
移除相应的监听事件
7. timeLine.reload(sectionArr, clipsArr)    
重新加载时间轴，sectionArr为视频片段的信息，clipsArr为剪辑后片段的信息

## 插件事件监听
1. 播放事件
```js
timeLine.on('play', function() {
  console.log('播放');
});
```
2. 暂停事件
```js
timeLine.on('pause', function() {
  console.log('暂停');
});
```
3. 保存事件
```js
timeLine.on('save', function(clipsArr, clippedArr) {
  console.log(clipsArr); //需要保存的视频片段
  console.log(clippedArr); //需要删除的视频片段
});
```
4. 另存事件
```js
timeLine.on('saveas', function(clipsArr, clippedArr) {
  console.log(clipsArr); //需要保存的视频片段
  console.log(clippedArr); //需要删除的视频片段
});
```
5. 单击移动游标事件
```js
timeLine.on('seekTo', function(time) {
  console.log(time); //游标移动之后的时间
  /*
  time: {
    id: 1, //视频的唯一标志
    time: 1000, //相对于当前视频的时间点
    absTime: 2000 //相对于所有视频的时间点
  }
  */
})
```
6. 预览事件
```js
timeLine.on('previewStart', function(clipsArr, clippedArr) {
  console.log(clipsArr); //当前需要保存的视频片段
  console.log(clippedArr); //当前剪辑掉的视频片段
});
```
7. 索引创建事件
```js
timeLine.on('createIndex', function(time) {
  console.log(time); // 所创建的索引信息
  /*
  time: {
    id: 1, //视频的唯一标志
    time: 1000, //相对于当前视频的时间点
    absTime: 2000 //相对于所有视频的时间点
  }
  */
})
```
8. 索引删除事件
```js
timeLine.on('delIndex', function(time) {
  console.log(time); //删除的索引信息
  /*
  time: {
    id: 1, //视频的唯一标志
    time: 1000, //相对于当前视频的时间点
    absTime: 2000 //相对于所有视频的时间点
  }
  */
})
```
