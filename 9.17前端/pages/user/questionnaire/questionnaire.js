// pages/user/questionnaire/questionnaire.js
Page({

    // 查看发布的问卷
  // 查看发布的问卷
  viewPublishedQuestionnaires() {
    wx.navigateTo({
      url: '/pages/user/questionnaire/published/questionnaire'
    });
  },

  // 查看已填写的问卷
  viewCompletedQuestionnaires() {
    wx.navigateTo({
      url: '/pages/user/questionnaire/finish/finish'
    });
  }
});