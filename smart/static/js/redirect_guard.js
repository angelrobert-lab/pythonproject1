// 重定向守卫 - 确保注册成功后能正确跳转到登录页面

// 立即执行函数，确保脚本加载后立即生效
(function() {
    // 检查当前页面是否为注册页面
    const isRegisterPage = window.location.pathname.includes('/register');
    
    // 如果是注册页面，添加额外的重定向保险
    if (isRegisterPage) {
        console.log('重定向守卫：已在注册页面激活');
        
        // 设置一个全局变量，用于跟踪重定向状态
        window.__registerRedirectStatus = {
            attempted: false,
            completed: false
        };
        
        // 添加备用重定向逻辑，确保即使主逻辑失败也能重定向
        function setupRedirectGuard() {
            // 监听页面消息，看是否有注册成功的信号
            window.addEventListener('message', function(event) {
                if (event.data === 'register_success') {
                    console.log('重定向守卫：接收到注册成功信号');
                    performRedirect();
                }
            });
            
            // 监听DOM变化，检查是否有注册成功的提示信息
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes) {
                        for (let i = 0; i < mutation.addedNodes.length; i++) {
                            const node = mutation.addedNodes[i];
                            if (node.textContent && 
                                (node.textContent.includes('注册成功') || 
                                 node.textContent.includes('正在跳转到登录页面'))) {
                                console.log('重定向守卫：检测到注册成功消息');
                                performRedirect();
                            }
                        }
                    }
                });
            });
            
            // 开始观察body的变化
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            // 设置一个超时重定向，作为最后的保险
            setTimeout(function() {
                if (!window.__registerRedirectStatus.completed) {
                    console.log('重定向守卫：超时触发强制重定向');
                    // 显示一个确认对话框
                    if (confirm('注册似乎已完成，但未自动跳转到登录页面。\n\n是否立即跳转到登录页面？')) {
                        performRedirect();
                    }
                }
            }, 15000); // 15秒后触发
        }
        
        // 执行重定向的核心函数
        function performRedirect() {
            if (window.__registerRedirectStatus.attempted) {
                return; // 已经尝试过重定向，避免重复执行
            }
            
            window.__registerRedirectStatus.attempted = true;
            
            // 确定重定向目标URL
            const redirectUrl = '/smart/login/';
            console.log('重定向守卫：准备重定向到', redirectUrl);
            
            try {
                // 使用多种方式尝试重定向
                // 方式1：标准的window.location.href
                window.location.href = redirectUrl;
                
                // 方式2：如果方式1失败，尝试replace
                setTimeout(function() {
                    if (!window.__registerRedirectStatus.completed) {
                        console.log('重定向守卫：尝试使用replace方法');
                        window.location.replace(redirectUrl);
                    }
                }, 500);
                
                // 方式3：如果前两种都失败，使用assign
                setTimeout(function() {
                    if (!window.__registerRedirectStatus.completed) {
                        console.log('重定向守卫：尝试使用assign方法');
                        window.location.assign(redirectUrl);
                    }
                }, 1000);
                
                // 标记重定向完成（理论上，如果重定向成功，下面的代码不会执行）
                window.__registerRedirectStatus.completed = true;
            } catch (error) {
                console.error('重定向守卫：重定向过程中发生错误', error);
                // 如果重定向失败，显示一个链接让用户手动点击
                showManualRedirectLink(redirectUrl);
            }
        }
        
        // 显示手动重定向链接
        function showManualRedirectLink(url) {
            // 检查是否已经存在重定向提示
            let redirectPrompt = document.getElementById('redirectPrompt');
            if (!redirectPrompt) {
                redirectPrompt = document.createElement('div');
                redirectPrompt.id = 'redirectPrompt';
                redirectPrompt.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #fff;
                    padding: 15px;
                    border: 2px solid #4CAF50;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    max-width: 300px;
                `;
                
                const link = document.createElement('a');
                link.href = url;
                link.textContent = '点击跳转到登录页面';
                link.style.cssText = `
                    color: #4CAF50;
                    text-decoration: underline;
                    font-weight: bold;
                `;
                
                const message = document.createElement('p');
                message.textContent = '注册已完成，但自动重定向失败。';
                message.style.marginBottom = '10px';
                
                redirectPrompt.appendChild(message);
                redirectPrompt.appendChild(link);
                document.body.appendChild(redirectPrompt);
            }
        }
        
        // 初始化重定向守卫
        setupRedirectGuard();
        
        // 扩展fetch API，监控所有请求的响应
        const originalFetch = window.fetch;
        window.fetch = function(resource, options) {
            // 检查是否是注册请求
            const isRegisterRequest = typeof resource === 'string' && 
                                      resource.includes('/register');
            
            return originalFetch.apply(this, arguments).then(function(response) {
                // 对于注册请求，额外检查响应
                if (isRegisterRequest && options && options.method === 'POST') {
                    // 克隆响应，以便我们可以读取它
                    const clonedResponse = response.clone();
                    
                    clonedResponse.json().then(function(data) {
                        if (data && data.status === 'success') {
                            console.log('重定向守卫：检测到注册成功响应');
                            // 短暂延迟后执行重定向
                            setTimeout(performRedirect, 500);
                        }
                    }).catch(function() {
                        // 非JSON响应，忽略
                    });
                }
                
                return response;
            });
        };
    }
})();