// pages/admin/questionnaire/questionnaire.js
// 引入请求工具类
const request = require('../../../utils/request.js');

Page({
  data: {
    questionnaires: [], // 问卷列表
    originalQuestionnaires: [], // 原始问卷列表，用于重置
    searchValue: '',   // 搜索值
    showEmpty: false   // 是否显示空状态
  },

  onLoad() {
    // 加载问卷数据
    this.loadQuestionnaires();
  },

  // 加载问卷数据 - 从Django后端API获取
  loadQuestionnaires() {
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
    });
    
    // 修改API端点，使用/smart/get_questionnaires/获取所有问卷
    request.get('/smart/get_questionnaires/')
      .then(res => {
        // 检查响应是否包含data字段，如果是则使用res.data.data作为问卷列表
        const questionnaires = res.data?.data || res.data || [];
        this.setData({
          questionnaires: questionnaires,
          originalQuestionnaires: questionnaires,
          showEmpty: questionnaires.length === 0
        });
      })
      .catch(err => {
        console.error('加载问卷数据失败:', err);
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
        // 加载失败时显示空数据
        this.setData({
          questionnaires: [],
          originalQuestionnaires: [],
          showEmpty: true
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  // 创建新问卷
  createNewQuestionnaire() {
    wx.navigateTo({
      url: '/pages/admin/questionnaire/create/create'
    });
  },

  // 搜索问卷
  onSearch(e) {
    this.setData({
      searchValue: e.detail.value
    });
    this.filterQuestionnaires();
  },

  // 点击搜索图标触发搜索
  triggerSearch() {
    this.filterQuestionnaires();
  },

  // 筛选问卷
  filterQuestionnaires() {
    const { searchValue, originalQuestionnaires } = this.data;
    if (!searchValue.trim()) {
      // 如果搜索值为空，显示所有问卷
      this.setData({
        questionnaires: originalQuestionnaires,
        showEmpty: originalQuestionnaires.length === 0
      });
      return;
    }

    // 筛选出名称中包含搜索值的问卷
    const filtered = originalQuestionnaires.filter(item => {
      return item.title.includes(searchValue);
    });

    this.setData({
      questionnaires: filtered,
      showEmpty: filtered.length === 0
    });
  },

  // 处理获取到的问卷数据
  handleQuestionnaireData: function(questionnaire, source) {
    console.log(`从${source}获取到问卷数据:`, questionnaire);
    
    // 创建一个干净的副本以避免修改原始数据
    let cleanQuestionnaire = {};
    try {
      // 深拷贝问卷数据
      cleanQuestionnaire = JSON.parse(JSON.stringify(questionnaire || {}));
      
      // 确保基本字段存在
      if (!cleanQuestionnaire.title) cleanQuestionnaire.title = '未命名问卷';
      if (!cleanQuestionnaire.id) cleanQuestionnaire.id = questionnaire.id || 0;
      
      console.log('原始问卷数据结构:', JSON.stringify(Object.keys(cleanQuestionnaire)));
      
      // 直接使用原始的题目数据，避免过滤掉有效的题目
      let originalQuestions = [];
      
      // 检查是否有questions字段
      if (cleanQuestionnaire.questions && Array.isArray(cleanQuestionnaire.questions)) {
        originalQuestions = cleanQuestionnaire.questions;
        console.log('从questions字段获取到题目数量:', originalQuestions.length);
      } else {
        console.log('警告：问卷数据中没有有效的questions数组');
        // 尝试通过单独的API获取题目数据
        const id = questionnaire.id || 0;
        request.get(`/api/questionnaires/${id}/questions/`)
            .then(questionsRes => {
            if (questionsRes.data && Array.isArray(questionsRes.data)) {
              console.log('通过单独API获取到题目数量:', questionsRes.data.length);
              originalQuestions = questionsRes.data;
              cleanQuestionnaire.questions = originalQuestions;
              this.__saveAndNavigate(cleanQuestionnaire, id);
            } else {
              console.log('无法通过单独API获取题目数据');
              this.__saveAndNavigate(cleanQuestionnaire, id);
            }
          })
          .catch(err => {
            console.error('获取题目数据失败:', err);
            this.__saveAndNavigate(cleanQuestionnaire, id);
          });
        return; // 先不继续执行，等待题目数据获取完成
      }
      
      // 打印原始题目数据以便调试
      console.log('原始题目数据:', originalQuestions);
      
      // 设置题目数组
      cleanQuestionnaire.questions = originalQuestions;
      
      this.__saveAndNavigate(cleanQuestionnaire, cleanQuestionnaire.id);
    } catch (error) {
      console.error('处理问卷数据时发生错误:', error);
      wx.showToast({
        title: '处理问卷数据失败',
        icon: 'none'
      });
    }
  },
  
  // 查看问卷
  viewQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    
    // 显示加载提示
    wx.showLoading({
      title: '加载问卷中...',
    });
    
    // 尝试从本地存储获取问卷数据作为备选方案
    const questionnaires = wx.getStorageSync('questionnaires') || [];
    const localQuestionnaire = questionnaires.find(q => q.id === id);
    
    // 打印调试信息
    console.log('查看问卷 ID:', id);
    console.log('本地存储中是否存在该问卷:', !!localQuestionnaire);
    if (localQuestionnaire) {
      console.log('本地存储中问卷的题目数量:', localQuestionnaire.questions ? localQuestionnaire.questions.length : 0);
    }
    
    // 保存并跳转的辅助方法
    this.__saveAndNavigate = function(cleanQuestionnaire, id) {
      console.log('最终传递的题目数量:', cleanQuestionnaire.questions.length);
      
      try {
        // 将问卷数据通过URL参数传递给预览页面
        const previewData = encodeURIComponent(JSON.stringify(cleanQuestionnaire));
        console.log('准备跳转至预览页面，传递数据长度:', previewData.length);
        
        // 设置本地存储以便预览页面备用获取
        try {
          wx.setStorageSync('previewQuestionnaire', cleanQuestionnaire);
          console.log('已成功保存到previewQuestionnaire');
        } catch (storageError) {
          console.error('保存到本地存储失败:', storageError);
          // 尝试清除旧数据后再次保存
          try {
            wx.removeStorageSync('previewQuestionnaire');
            wx.setStorageSync('previewQuestionnaire', cleanQuestionnaire);
            console.log('清除旧数据后保存成功');
          } catch (retryError) {
            console.error('重试保存失败:', retryError);
          }
        }
        
        wx.navigateTo({
          url: `/pages/admin/questionnaire/preview/preview?previewData=${previewData}&id=${id}`
        });
      } catch (error) {
        console.error('序列化问卷数据失败:', error);
        // 如果序列化失败，尝试直接使用ID跳转，并确保本地存储有数据
        try {
          wx.setStorageSync('previewQuestionnaire', cleanQuestionnaire);
        } catch (storageError) {
          console.error('保存到本地存储失败:', storageError);
        }
        wx.navigateTo({
          url: `/pages/admin/questionnaire/preview/preview?id=${id}`
        });
      }
    };
    
    // 直接使用获取单个问卷的API，这可能更可靠
    request.get(`/api/questionnaires/${id}/`)
      .then(res => {
        // 隐藏加载提示
        wx.hideLoading();
        
        console.log(`从/api/questionnaires/${id}/获取响应:`, res);
        
        // 检查响应数据
        console.log('res.data是否存在:', !!res.data);
        console.log('res.data类型:', typeof res.data);
        console.log('res.data是否为null:', res.data === null);
        console.log('res.data是否为对象且不为null:', res.data && typeof res.data === 'object' && res.data !== null);
        console.log('res.data JSON:', JSON.stringify(res.data));
        
        // 检查res本身是否包含数据（直接在res对象中）
        console.log('res是否包含id字段:', !!res.id);
        console.log('res本身类型:', typeof res);
        console.log('res JSON:', JSON.stringify(res));
        
        // 根据数据所在位置确定使用哪个对象
        let questionnaireData = null;
        if (res.data && typeof res.data === 'object' && res.data !== null && res.data.id) {
          questionnaireData = res.data;
        } else if (res && typeof res === 'object' && res !== null && res.id) {
          // 数据直接在res对象中（API响应格式不同）
          console.log('检测到数据直接在res对象中，使用res而不是res.data');
          questionnaireData = res;
        }
        
        // 检查是否找到有效数据
        if (questionnaireData) {
          console.log('从API找到有效的问卷数据，ID:', questionnaireData.id);
            console.log('问卷标题:', questionnaireData.title || '无标题');
            console.log('是否包含题目数组:', !!questionnaireData.questions && Array.isArray(questionnaireData.questions));
            if (questionnaireData.questions && Array.isArray(questionnaireData.questions)) {
              console.log('从API找到的问卷题目数量:', questionnaireData.questions.length);
            }
            this.handleQuestionnaireData(questionnaireData, 'API (api/questionnaires/id/)');
          return; // 确保后续代码不会执行
        }
        
        if (localQuestionnaire) {
          console.log('API未返回有效数据，使用本地存储数据');
          this.handleQuestionnaireData(localQuestionnaire, '本地存储');
          return; // 确保后续代码不会执行
        }
        
        console.error('API和本地存储均未找到有效问卷数据');
        // 尝试使用备用API获取题目
        request.get(`/api/questionnaires/${id}/questions/`)
          .then(questionsRes => {
              if (questionsRes.data && Array.isArray(questionsRes.data) && questionsRes.data.length > 0) {
                console.log('通过备用API获取到题目数量:', questionsRes.data.length);
                const fallbackQuestionnaire = {
                  id: id,
                  title: '问卷 #' + id,
                  questions: questionsRes.data
                };
                this.handleQuestionnaireData(fallbackQuestionnaire, '备用API (api/questions/)');
              } else {
                wx.showToast({
                  title: '获取问卷数据失败',
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              console.error('获取题目数据失败:', err);
              wx.showToast({
                title: '获取问卷数据失败',
                icon: 'none'
              });
            });
      })
      .catch(err => {
        console.error(`使用/api/questionnaires/${id}/获取失败:`, err);
        wx.hideLoading();
        
        // 如果第一个API失败，尝试使用/smart/get_questionnaires/获取所有问卷
        request.get('/smart/get_questionnaires/')
          .then(res => {
            console.log('从/smart/get_questionnaires/获取响应:', res);
            
            // 检查响应数据
            let allQuestionnaires = [];
            if (res.data?.data) {
              allQuestionnaires = res.data.data;
            } else if (res.data && Array.isArray(res.data)) {
              allQuestionnaires = res.data;
            }
            
            console.log('获取到的问卷列表数量:', allQuestionnaires.length);
            
            // 筛选出所需的问卷
            const foundQuestionnaire = allQuestionnaires.find(q => q.id === id);
            
            if (foundQuestionnaire) {
                this.handleQuestionnaireData(foundQuestionnaire, 'API (smart/get_questionnaires/)');
              } else if (localQuestionnaire) {
                this.handleQuestionnaireData(localQuestionnaire, '本地存储');
            } else {
              console.error('所有API都失败，尝试直接获取题目');
              // 尝试使用备用API获取题目
              request.get(`/api/questionnaires/${id}/questions/`)
                .then(questionsRes => {
                  if (questionsRes.data && Array.isArray(questionsRes.data) && questionsRes.data.length > 0) {
                    console.log('通过备用API获取到题目数量:', questionsRes.data.length);
                    const fallbackQuestionnaire = {
                      id: id,
                      title: '问卷 #' + id,
                      questions: questionsRes.data
                    };
                    this.handleQuestionnaireData(fallbackQuestionnaire, '备用API (api/questions/)');
                  } else {
                    wx.showToast({
                      title: '获取问卷数据失败，请重试',
                      icon: 'none'
                    });
                  }
                })
                .catch(err2 => {
                  console.error('获取题目数据失败:', err2);
                  wx.showToast({
                    title: '获取问卷数据失败，请重试',
                    icon: 'none'
                  });
                });
            }
          })
          .catch(err2 => {
            console.error('使用/smart/get_questionnaires/获取失败:', err2);
            
            // 两个API都失败，尝试使用本地存储的数据
            if (localQuestionnaire) {
              try {
                this.handleQuestionnaireData(localQuestionnaire, '本地存储 (备用)');
              } catch (error) {
                console.error('处理本地存储数据失败:', error);
                wx.showToast({
                  title: '获取问卷数据失败，请重试',
                  icon: 'none'
                });
              }
            } else {
              console.error('所有数据来源都失败');
              wx.showToast({
                title: '获取问卷数据失败，请重试',
                icon: 'none'
              });
            }
          });
      });
  },

  // 编辑问卷
  editQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/questionnaire/create/create?id=${id}`
    });
  },

  // 批阅问卷
  reviewQuestionnaire() {
    wx.navigateTo({
      url: '/pages/common/judge/judge'
    });
  },

  // 删除问卷 - 调用Django后端API
  deleteQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该问卷吗？此操作不可恢复',
      success(res) {
        if (res.confirm) {
          // 显示加载提示
          wx.showLoading({
            title: '删除中...',
          });
          
          // 调用API删除问卷
          request.delete(`/api/questionnaires/${id}/`)
            .then(() => {
              // 删除成功后刷新列表
              that.loadQuestionnaires();
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            })
            .catch(err => {
              console.error('删除问卷失败:', err);
              wx.showToast({
                title: '删除失败，请重试',
                icon: 'none'
              });
            })
            .finally(() => {
              wx.hideLoading();
            });
        }
      }
    });
  },

  // 获取问卷数据并导出
  exportQuestionnaire(e) {
    const id = e.currentTarget.dataset.id;
    // 显示加载提示
    wx.showLoading({
      title: '获取问卷数据中...',
    });
    
    // 首先从本地数据中查找问卷
    const localQuestionnaire = this.data.questionnaires.find(item => item.id === id);
    
    if (localQuestionnaire) {
      // 如果本地有该问卷，直接尝试从API获取完整数据用于导出
      request.get(`/smart/get_questionnaires/?id=${id}`)
        .then(res => {
          const apiData = res.data?.data || res.data || [];
          let questionnaire = null;
          
          if (apiData.length > 0) {
            questionnaire = apiData[0];
          } else {
            // 如果API获取失败，使用本地数据作为基础，添加一些默认值
            questionnaire = {
              ...localQuestionnaire,
              // 添加导出所需的默认字段
              questions: []
            };
          }
          
          this.processAndExportQuestionnaire(questionnaire);
        })
        .catch(err => {
          console.error('获取完整问卷数据失败:', err);
          // 错误情况下，使用本地基础数据进行导出
          const questionnaire = {
            ...localQuestionnaire,
            questions: []
          };
          this.processAndExportQuestionnaire(questionnaire);
        });
    } else {
      wx.hideLoading();
      wx.showToast({
        title: '未找到问卷数据',
        icon: 'none'
      });
    }
  },
  
  // 处理并导出问卷数据
  processAndExportQuestionnaire(questionnaire) {
    if (!questionnaire) {
      wx.hideLoading();
      wx.showToast({
        title: '未找到问卷数据',
        icon: 'none'
      });
      return;
    }
    
    // 转换为格式化的文本
    let content = `问卷名称: ${questionnaire.title || '无标题'}\n`;
    content += `创建时间: ${questionnaire.created_at || questionnaire.createdAt || '未知时间'}\n`;
    // 将英文状态转换为中文显示
    const statusMap = {
      'draft': '草稿',
      'published': '已发布',
      'archived': '已归档'
    };
    content += `状态: ${statusMap[questionnaire.status] || questionnaire.status || '未知状态'}\n`;
    content += `描述: ${questionnaire.description || '无描述'}\n\n`;
    
    // 添加问题
    if (questionnaire.questions && questionnaire.questions.length > 0) {
      content += `问题列表 (${questionnaire.questions.length}个问题):\n\n`;
      questionnaire.questions.forEach((question, index) => {
        content += `${index + 1}. ${question.title || '无标题'}\n`;
        content += `类型: ${question.type === 'single' ? '单选题' : 
                   question.type === 'multiple' ? '多选题' : 
                   question.type === 'text' ? '问答题' : 
                   question.type === 'blank' ? '填空题' : 
                   question.type === 'draw' ? '画图题(' + question.subTypeName + ')' : 
                   question.type === 'matrix' ? '勾选题' : '其他题型'}\n`;
        
        // 添加选项（如果有）
        if (question.options && question.options.length > 0) {
          content += '选项:\n';
          question.options.forEach((option, optIndex) => {
            content += `  ${String.fromCharCode(65 + optIndex)}. ${option}\n`;
          });
        }
        
        content += '\n';
      });
    }
    
    try {
      // 小程序本地文件系统API
      const fs = wx.getFileSystemManager();
      // 使用markdown格式可能兼容性更好
      const fileName = `${questionnaire.title}_${Date.now()}.md`;
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      
      // 写入文件
      fs.writeFileSync(filePath, content, 'utf-8');
      
      // 尝试获取设备信息并判断环境
      let isWindows = false;
      let isPC = false;
      
      try {
        // 尝试检测设备信息
        const deviceInfo = wx.getDeviceInfo && wx.getDeviceInfo();
        if (deviceInfo && deviceInfo.platform) {
          isPC = deviceInfo.platform === 'windows' || deviceInfo.platform === 'macos';
          isWindows = deviceInfo.platform === 'windows';
        }
      } catch (deviceInfoErr) {
        console.warn('获取设备信息失败:', deviceInfoErr);
      }
      
      // 再次尝试使用getSystemInfoSync检测
      if (wx.getSystemInfoSync) {
        try {
          const systemInfo = wx.getSystemInfoSync();
          if (systemInfo && systemInfo.platform) {
            isPC = isPC || systemInfo.platform === 'windows' || systemInfo.platform === 'macos';
            isWindows = isWindows || /windows/i.test(systemInfo.platform);
          }
        } catch (e) {
          console.warn('获取系统信息失败:', e);
        }
      }
      
      // 根据环境选择不同的导出方式
      if (isPC || isWindows) {
        this.handleWindowsOrPCEexport(filePath, content, fileName);
      } else {
        this.handleMobileExport(filePath, content, fileName);
      }
    } catch (err) {
      console.error('导出过程异常:', err);
      wx.showModal({
        title: '导出成功',
        content: '问卷内容已生成，由于系统限制无法保存文件。您可以手动复制下方内容：\n' + content.substring(0, 100) + '...',
        showCancel: false
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 处理Windows或PC环境的导出
  handleWindowsOrPCEexport(filePath, content, fileName) {
    try {
      // 优先使用PC端的saveFileToDisk功能
      if (wx.saveFileToDisk) {
        wx.saveFileToDisk({
          filePath: filePath,
          success: () => {
            wx.showToast({
              title: '导出成功',
              icon: 'success'
            });
          },
          fail: (err) => {
            console.error('保存到磁盘失败:', err);
            this.showCopyContentModal(filePath, content);
          }
        });
      } else {
        // 降级处理：提供文件路径和复制选项
        this.showCopyContentModal(filePath, content);
      }
    } catch (err) {
      console.error('文件操作异常:', err);
      this.showCopyContentModal(filePath, content);
    }
  },
  
  // 处理移动环境的导出
  handleMobileExport(filePath, content, fileName) {
    try {
      // 根据实际文件扩展名设置fileType
      wx.openDocument({
        filePath: filePath,
        fileType: fileName.endsWith('.md') ? 'md' : 'txt',
        showMenu: true,
        success: () => {
          console.log('文件打开成功');
        },
        fail: (err) => {
          console.error('文件打开失败:', err);
          this.trySaveFile(filePath, content);
        }
      });
    } catch (err) {
      console.error('文件操作异常:', err);
      this.trySaveFile(filePath, content);
    }
  },
  
  // 尝试保存文件
  trySaveFile(filePath, content) {
    const fs = wx.getFileSystemManager();
    try {
      fs.saveFile({
        tempFilePath: filePath,
        success: function(res) {
          const savedFilePath = res.savedFilePath;
          wx.showModal({
            title: '导出成功',
            content: '文件已保存至:\n' + savedFilePath + '\n\n请前往该目录查看',
            showCancel: false
          });
        },
        fail: function(saveErr) {
          console.error('fs.saveFile失败', saveErr);
          // 如果保存失败，直接提供复制选项
          wx.showModal({
            title: '导出成功',
            content: '问卷内容已生成，由于系统限制无法保存文件。您可以手动复制下方内容：\n' + content.substring(0, 100) + '...',
            showCancel: false
          });
        }
      });
    } catch (err) {
      console.error('文件操作异常:', err);
      wx.showModal({
        title: '导出成功',
        content: '问卷内容已生成，由于系统限制无法保存文件。您可以手动复制下方内容：\n' + content.substring(0, 100) + '...',
        showCancel: false
      });
    }
  },
  
  // 显示复制内容的模态框
  showCopyContentModal(filePath, content) {
    wx.showModal({
      title: '导出成功',
      content: '文件已保存至临时目录:\n' + filePath + '\n\n请手动复制下方完整内容:',
      confirmText: '复制内容',
      cancelText: '我知道了',
      success: (res) => {
        if (res.confirm) {
          // 尝试复制内容到剪贴板
          wx.setClipboardData({
            data: content,
            success: () => {
              wx.showToast({
                title: '内容已复制到剪贴板',
                icon: 'success'
              });
            },
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '问卷内容已生成，请手动记录下方内容:\n' + content.substring(0, 200) + '...',
                showCancel: false
              });
            }
          });
        }
      }
    });
  },

  // 获取问卷数据并导出
  exportQuestionnaire(id) {
    wx.showLoading({
      title: '正在导出...',
    });
    
    try {
      // 首先从本地数据查找问卷
      const localQuestionnaire = this.data.questionnaires.find(item => item.id === id);
      
      if (localQuestionnaire) {
        // 如果本地有数据，先尝试获取完整数据
        request.get(`/smart/get_questionnaires/?id=${id}`)
          .then(res => {
            if (res && res.data && res.data.length > 0) {
              // 使用完整数据进行导出
              this.processAndExportQuestionnaire(res.data[0]);
            } else {
              // 如果获取完整数据失败，使用本地数据并添加必要字段
              this.processAndExportQuestionnaire(localQuestionnaire);
            }
          })
          .catch(err => {
            console.error('获取完整数据失败，使用本地数据:', err);
            this.processAndExportQuestionnaire(localQuestionnaire);
          });
      } else {
        // 本地没有数据，尝试从API获取
        request.get(`/smart/get_questionnaires/?id=${id}`)
          .then(res => {
            if (res && res.data && res.data.length > 0) {
              this.processAndExportQuestionnaire(res.data[0]);
            } else {
              wx.hideLoading();
              wx.showToast({
                title: '未找到问卷数据',
                icon: 'none'
              });
            }
          })
          .catch(err => {
            wx.hideLoading();
            console.error('获取问卷数据失败:', err);
            wx.showToast({
              title: '获取数据失败，请重试',
              icon: 'none'
            });
          });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('导出过程异常:', err);
      wx.showToast({
        title: '导出失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 显示问卷状态 - 只显示状态信息，不再执行状态切换操作
  toggleQuestionnaireStatus(e) {
    const id = e.currentTarget.dataset.id;
    
    // 查找当前问卷的状态
    const currentQuestionnaire = this.data.questionnaires.find(item => item.id === id);
    if (!currentQuestionnaire) {
      wx.showToast({
        title: '未找到问卷',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前状态并进行标准化显示
    let currentStatus = currentQuestionnaire.status;
    
    // 状态映射，用于显示中文状态
    const statusMap = {
      'draft': '草稿',
      'published': '已发布',
      'archived': '已归档'
    };
    
    // 标准化状态显示
    let displayStatus = '未知状态';
    if (currentStatus && typeof currentStatus === 'string') {
      // 转换中文状态为标准显示
      if (currentStatus.indexOf('草') !== -1) displayStatus = '草稿';
      else if (currentStatus.indexOf('发') !== -1) displayStatus = '已发布';
      else if (currentStatus.indexOf('档') !== -1) displayStatus = '已归档';
      // 直接匹配英文状态
      else if (statusMap[currentStatus]) displayStatus = statusMap[currentStatus];
    }
    
    // 只显示当前状态，不再执行切换操作
    wx.showToast({
      title: `当前状态: ${displayStatus}`,
      icon: 'none',
      duration: 2000
    });
  }
});

// 显式导出模块以确保微信小程序能正确识别
module.exports = Page;