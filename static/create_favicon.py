# 在项目根目录创建create_favicon.py
from PIL import Image
import os

# 创建一个简单的16x16像素的favicon
img = Image.new('RGB', (16, 16), color='blue')
img.save('static/favicon.ico')