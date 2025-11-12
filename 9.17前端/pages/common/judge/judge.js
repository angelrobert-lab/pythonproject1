Page({

viewPublishedQuestionnaires() {
  wx.navigateTo({
    url: '/pages/common/judge-answer/judge-answer'
  });
},


viewCompletedQuestionnaires() {
  wx.navigateTo({
    url: '/pages/common/judge-finsh/judge-finsh'
  });
}
});