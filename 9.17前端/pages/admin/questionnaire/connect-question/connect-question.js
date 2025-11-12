// pages/admin/questionnaire/connect-question/connect-question.js
Page({
    data: {
      questionIndex: -1,
      moduleIndex: -1,
      question: {
        type: 'draw',
        subType: 'connect',
        subTypeName: '连线题',
        title: '',
        exampleImage: '',
        drawingData: '',
        promptText: '请依照例图所示对本题进行1➡甲➡2➡乙……的顺序连线',
        canvasWidth: 0,
        canvasHeight: 0,
        canvasScale: 1,
        labels: [], // 保存标签数据
        lines: []   // 保存线条数据
      },
      isNew: true,
      imageUrl: '',
      context: null,
      canvas: null,
      isDrawing: false,
      isDragging: false,
      draggingLabel: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      currentColor: '#000000',
      currentLineWidth: 5, // 默认线宽
      labels: [], // 存储标签信息
      lines: [], // 存储所有线条
      tempLine: null, // 实时绘制的临时线条
      lastTapTime: 0, // 上次点击时间
      lastTapX: 0, // 上次点击X坐标
      lastTapY: 0, // 上次点击Y坐标
      history: [], // 历史操作记录
      canvasScale: 1, // 画布缩放比例
      // 颜色按钮状态（动态控制选中反馈）
      colorBtns: [
        { color: '#000000', active: true },   // 黑色（默认选中）
        { color: '#FF0000', active: false },  // 红色
        { color: '#00FF00', active: false },  // 绿色
        { color: '#0000FF', active: false }   // 蓝色
      ],
      // 线宽按钮状态（动态控制选中反馈）
      lineWidths: [
        { width: 2, active: false },
        { width: 5, active: true },   // 默认选中
        { width: 10, active: false }
      ]
    },
  
    onLoad(options) {
      const { index, moduleIndex } = options;
      // 获取系统信息（兼容旧API）
      const systemInfo = wx.getSystemInfoSync();
      const canvasScale = systemInfo.pixelRatio;
      
      this.setData({
        canvasScale: canvasScale,
        'question.canvasScale': canvasScale
      });
  
      // 编辑已有问题时恢复数据
      if (index !== undefined) {
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        const question = prevPage.data.questions[index];
        
        this.setData({
          questionIndex: parseInt(index),
          question: { 
            ...question,
            canvasScale: canvasScale 
          },
          isNew: false,
          imageUrl: question.exampleImage || '',
          labels: question.labels || [],
          lines: question.lines || []
        });
      } else {
        this.setData({ isNew: true
        });
      }
      
      // 保存模块索引
      if (moduleIndex !== undefined) {
        this.setData({
          moduleIndex: parseInt(moduleIndex)
        });
      }

      // 延迟初始化画布，确保DOM加载完成
      setTimeout(() => {
        this.initCanvas();
      }, 100);
    },
  
    // 初始化画布
    initCanvas() {
      wx.createSelectorQuery()
        .select('#myCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) {
            console.error('未找到ID为"myCanvas"的画布元素');
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const width = res[0].width;
          const height = res[0].height;
          const scale = this.data.canvasScale;
          
          // 设置画布高清尺寸
          canvas.width = width * scale;
          canvas.height = height * scale;
          ctx.scale(scale, scale);
          
          this.setData({
            canvas: canvas,
            context: ctx,
            'question.canvasWidth': width,
            'question.canvasHeight': height
          }, () => {
            // 恢复已有绘图数据
            if (!this.data.isNew && this.data.question.drawingData) {
              this.redrawCanvas();
            }
          });
        });
    },
  
    // 标题输入
    onTitleInput(e) {
      this.setData({ 'question.title': e.detail.value });
    },
  
    // 上传例图
    uploadImage() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath;
          wx.getFileSystemManager().readFile({
            filePath: tempFilePath,
            encoding: 'base64',
            success: (res) => {
              const base64Image = `data:image/png;base64,${res.data}`;
              this.setData({
                imageUrl: tempFilePath,
                'question.exampleImage': base64Image
              }, () => this.redrawCanvas());
            },
            fail: (err) => {
              console.error('图片读取失败：', err);
              wx.showToast({ title: '图片处理失败', icon: 'none' });
            }
          });
        }
      });
    },
  
    // 双击创建标签
    handleDoubleTap(x, y) {
      wx.showModal({
        title: '创建标签',
        content: '',
        editable: true,
        placeholderText: '请输入标签内容',
        success: (res) => {
          if (res.confirm && res.content.trim()) {
            const newLabel = {
              id: Date.now(),
              text: res.content.trim(),
              x: x,
              y: y,
              radius: 20 // 标签半径
            };
            
            // 记录历史操作
            const history = [...this.data.history, { 
              type: 'addLabel', 
              data: newLabel 
            }];
            
            this.setData({
              labels: [...this.data.labels, newLabel],
              history
            }, () => this.redrawCanvas());
          }
        }
      });
    },
  
    // 触摸开始（绘制/拖拽）
    canvasTouchStart(e) {
      if (!this.data.context) return;
      const { x, y } = e.touches[0];
      
      // 检查是否点击标签（优先拖拽）
      const labels = this.data.labels;
      for (let i = labels.length - 1; i >= 0; i--) {
        const label = labels[i];
        const dx = x - label.x;
        const dy = y - label.y;
        if (Math.sqrt(dx * dx + dy * dy) <= label.radius) {
          this.setData({
            isDragging: true,
            draggingLabel: label,
            startX: x,
            startY: y
          });
          return;
        }
      }
      
      // 开始绘制线条
      this.setData({
        isDrawing: true,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        tempLine: {
          startX: x,
          startY: y,
          points: [], // 存储轨迹点
          color: this.data.currentColor,
          lineWidth: this.data.currentLineWidth
        }
      });
    },
  
    // 触摸移动（绘制/拖拽）
    canvasTouchMove(e) {
      if (!this.data.context) return;
      
      // 标签拖拽逻辑
      if (this.data.isDragging && this.data.draggingLabel) {
        const { x, y } = e.touches[0];
        const dx = x - this.data.startX;
        const dy = y - this.data.startY;
        
        // 复制数组避免直接修改引用
        const labels = [...this.data.labels];
        const labelIndex = labels.findIndex(item => item.id === this.data.draggingLabel.id);
        if (labelIndex !== -1) {
          labels[labelIndex].x += dx;
          labels[labelIndex].y += dy;
          
          this.setData({
            startX: x,
            startY: y,
            labels: labels
          }, () => this.redrawCanvas()); // 数据更新后重绘
        }
        return;
      }
      
      // 线条绘制逻辑
      if (!this.data.isDrawing || !this.data.tempLine) return;
      const { x, y } = e.touches[0];
      const ctx = this.data.context;
  
      // 实时绘制当前线段
      ctx.beginPath();
      ctx.moveTo(this.data.lastX, this.data.lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = this.data.currentColor;
      ctx.lineWidth = this.data.currentLineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
  
      // 记录轨迹点（解决线条变直线问题）
      const tempLine = { ...this.data.tempLine };
      tempLine.points.push({ x, y });
      this.setData({ lastX: x, lastY: y, tempLine });
    },
  
    // 触摸结束（完成绘制/拖拽）
    canvasTouchEnd(e) {
      if (!this.data.context) return;
      
      // 结束拖拽
      if (this.data.isDragging) {
        const history = [...this.data.history, {
          type: 'moveLabel',
          data: { ...this.data.draggingLabel }
        }];
        this.setData({
          isDragging: false,
          draggingLabel: null,
          history
        });
        return;
      }
      
      // 结束绘制
      if (!this.data.isDrawing || !this.data.tempLine) return;
      const { x, y } = e.changedTouches[0];
      const currentTime = Date.now();
      const lastTapTime = this.data.lastTapTime;
      const lastTapX = this.data.lastTapX;
      const lastTapY = this.data.lastTapY;
  
      // 检测双击（创建标签）
      if (currentTime - lastTapTime < 300 && 
          Math.abs(x - lastTapX) < 20 && 
          Math.abs(y - lastTapY) < 20) {
        this.setData({
          isDrawing: false,
          tempLine: null,
          lines: this.data.lines.slice(0, -1),
          history: this.data.history.slice(0, -1)
        }, () => {
          this.redrawCanvas();
          this.handleDoubleTap(x, y);
          this.setData({ lastTapTime: 0 });
        });
        return;
      }
  
      // 记录点击信息
      this.setData({ lastTapTime: currentTime, lastTapX: x, lastTapY: y });
  
      // 保存完整线条轨迹
      const newLine = {
        id: Date.now(),
        ...this.data.tempLine,
        endX: x,
        endY: y
      };
      const history = [...this.data.history, { type: 'addLine', data: newLine }];
  
      this.setData({
        isDrawing: false,
        lines: [...this.data.lines, newLine],
        tempLine: null,
        history
      }, () => this.saveDrawingData());
    },
  
    // 绘制所有标签
    drawLabels() {
      const ctx = this.data.context;
      const labels = this.data.labels;
      if (!ctx || !labels.length) return;
  
      labels.forEach(label => {
        // 绘制圆形背景
        ctx.beginPath();
        ctx.arc(label.x, label.y, label.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
  
        // 绘制标签文字
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(label.text, label.x, label.y);
      });
    },
  
    // 绘制所有线条（保留轨迹）
    drawLines() {
      const ctx = this.data.context;
      const lines = this.data.lines;
      if (!ctx || !lines.length) return;
  
      lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        // 遍历轨迹点绘制完整线条
        line.points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      });
    },
  
    // 重绘画布
// 重绘画布
redrawCanvas() {
    const ctx = this.data.context;
    const canvas = this.data.canvas;
    if (!ctx || !canvas) return;
  
    // 清空画布（仅清空交互区域）
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
  
    // 仅绘制标签和连线
    this.drawLabels();
    this.drawLines();
  },
  
    // 选择颜色（更新选中反馈）
    selectColor(e) {
      const selectedColor = e.currentTarget.dataset.color;
      const colorBtns = this.data.colorBtns.map(btn => ({
        ...btn,
        active: btn.color === selectedColor
      }));
      this.setData({ currentColor: selectedColor, colorBtns });
    },
  
    // 选择线宽（更新选中反馈）
    selectLineWidth(e) {
      const selectedWidth = parseInt(e.currentTarget.dataset.width);
      const lineWidths = this.data.lineWidths.map(item => ({
        ...item,
        active: item.width === selectedWidth
      }));
      this.setData({ currentLineWidth: selectedWidth, lineWidths });
    },
  
    // 清空画布
    clearCanvas() {
      const ctx = this.data.context;
      const canvas = this.data.canvas;
      if (!ctx || !canvas) return;
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const history = [...this.data.history, {
        type: 'clear',
        data: { labels: [...this.data.labels], lines: [...this.data.lines] }
      }];
      this.setData({ labels: [], lines: [], history }, () => this.saveDrawingData());
    },
  
    // 撤销操作
    undo() {
      const history = [...this.data.history];
      if (history.length === 0) return;
      const lastAction = history.pop();
  
      switch (lastAction.type) {
        case 'addLabel':
          this.setData({
            labels: this.data.labels.filter(l => l.id !== lastAction.data.id),
            history
          }, () => this.redrawCanvas());
          break;
        case 'addLine':
          this.setData({
            lines: this.data.lines.filter(l => l.id !== lastAction.data.id),
            history
          }, () => this.redrawCanvas());
          break;
        case 'moveLabel':
          const labelIndex = this.data.labels.findIndex(l => l.id === lastAction.data.id);
          if (labelIndex !== -1) {
            const labels = [...this.data.labels];
            labels[labelIndex].x = lastAction.data.x;
            labels[labelIndex].y = lastAction.data.y;
            this.setData({ labels, history }, () => this.redrawCanvas());
          }
          break;
        case 'clear':
          this.setData({
            labels: lastAction.data.labels,
            lines: lastAction.data.lines,
            history
          }, () => this.redrawCanvas());
          break;
      }
    },
  
    // 保存绘图数据
    saveDrawingData() {
      const canvas = this.data.canvas;
      if (canvas) {
        this.setData({ 'question.drawingData': canvas.toDataURL('image/png') });
      }
    },
  
    // 保存问题
    saveQuestion() {
      if (!this.data.question.title.trim()) {
        wx.showToast({ title: '请输入问题标题', icon: 'none' });
        return;
      }
  
      this.saveDrawingData();
      this.setData({
        'question.labels': this.data.labels,
        'question.lines': this.data.lines,
        'question.canvasWidth': this.data.question.canvasWidth,
        'question.canvasHeight': this.data.question.canvasHeight,
        'question.canvasScale': this.data.canvasScale,
        'question.moduleIndex': this.data.moduleIndex
      }, () => {
        const pages = getCurrentPages();
        let createPage = null;
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i].route === 'pages/admin/questionnaire/create/create') {
            createPage = pages[i];
            break;
          }
        }
  
        if (createPage) {
      const questions = [...createPage.data.questions];
      const question = {...this.data.question};
      let modules = [...createPage.data.modules];

      // 确保问题包含模块名称信息
      if (question.moduleIndex !== undefined && question.moduleIndex >= 0 && createPage.data.modules && createPage.data.modules[question.moduleIndex]) {
        question.moduleName = createPage.data.modules[question.moduleIndex].name;
      }

      if (this.data.isNew) {
        questions.push(question);
        // 更新模块的问题计数
        if (question.moduleIndex !== undefined && question.moduleIndex >= 0 && modules) {
          if (!modules[question.moduleIndex].questionCount) {
            modules[question.moduleIndex].questionCount = 0;
          }
          modules[question.moduleIndex].questionCount++;
        }
      } else if (this.data.questionIndex >= 0 && this.data.questionIndex < questions.length) {
        questions[this.data.questionIndex] = question;
      } else {
        questions.push(question);
      }

          createPage.setData({ questions, modules }, () => {
            wx.navigateBack({ delta: pages.length - 1 - pages.indexOf(createPage) });
          });
        } else {
          wx.showToast({ title: '保存失败，未找到问卷页面', icon: 'none' });
        }
      });
    }
  });