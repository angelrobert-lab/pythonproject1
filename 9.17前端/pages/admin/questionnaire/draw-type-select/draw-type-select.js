// pages/admin/questionnaire/draw-type-select/draw-type-select.js
Page({
  data: {
    moduleIndex: -1
  },

  onLoad: function(options) {
    // 保存模块索引
    if (options.moduleIndex !== undefined) {
      this.setData({
        moduleIndex: parseInt(options.moduleIndex)
      });
    }
  },

  // 选择画图题型
  selectType: function(e) {
    const { type, name } = e.currentTarget.dataset;
    const { moduleIndex } = this.data;

    if (type === 'pattern') {
      // 跳转到画图案页面
      wx.navigateTo({
        url: `/pages/admin/questionnaire/draw-question/draw-question?moduleIndex=${moduleIndex}`
      });
    } else if (type === '3d') {
      // 跳转到画立体图页面
      wx.navigateTo({
        url: `/pages/admin/questionnaire/3d-draw-question/3d-draw-question?moduleIndex=${moduleIndex}`
      });
    } else if (type === 'clock') {
      // 跳转到画钟表页面
      wx.navigateTo({
        url: `/pages/admin/questionnaire/clock-draw-question/clock-draw-question?moduleIndex=${moduleIndex}`
      });
    } else if (type === 'connection') {
      // 跳转到连线题页面
      wx.navigateTo({
        url: `/pages/admin/questionnaire/connect-question/connect-question?moduleIndex=${moduleIndex}`
      });
    } else {
      // 获取上一个页面
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];

      // 调用上一个页面的方法，传递选择的题型信息
      prevPage.setData({
        selectedDrawType: type,
        selectedDrawTypeName: name
      });

      // 返回上一个页面
      wx.navigateBack();
    }
  },

  // 返回
  navigateBack: function() {
    wx.navigateBack();
  }
})