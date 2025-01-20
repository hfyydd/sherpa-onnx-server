# Sherpa-ONNX 语音识别服务器

这是一个基于 sherpa-onnx 的语音识别服务器，提供简单的 HTTP API 接口进行语音识别服务。

## 功能特点

- 支持多语言语音识别（中文、英文、日语、韩语、粤语）
- 使用 ONNX 模型进行高效推理
- 提供 RESTful API 接口
- 支持 WAV 格式音频文件上传
- 文件大小限制保护

## 安装

### 前置要求

- Node.js (建议 14.0.0 或更高版本)
- sherpa-onnx-node
- 下载对应的模型文件

### 安装步骤

1. 克隆项目并安装依赖：

```bash
npm install fastify @fastify/multipart sherpa-onnx-node
```

2. 下载模型文件并放置在正确的目录中。

## 配置

### 服务器配置

服务器默认配置：
- 端口：3002
- 主机：0.0.0.0
- 文件大小限制：10MB

### 模型配置

在 `server.js` 中的模型配置：

```javascript
const config = {
  'featConfig': {
    'sampleRate': 16000,
    'featureDim': 80,
  },
  'modelConfig': {
    'senseVoice': {
      'model': './sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/model.int8.onnx',
      'useInverseTextNormalization': 1,
    },
    'tokens': './sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/tokens.txt',
    'numThreads': 2,
    'provider': 'cpu',
    'debug': 1,
  }
};
```

## API 接口

### 1. 健康检查

```
GET /
```

响应示例：
```json
{
  "hello": "world"
}
```

### 2. 语音识别

```
POST /asr
Content-Type: multipart/form-data
```

请求参数：
- `file`: WAV 格式的音频文件（必须）

响应示例：
```json
{
  "success": true,
  "text": "识别出的文本内容"
}
```

错误响应：
```json
{
  "success": false,
  "error": "错误信息"
}
```

注意事项：
- 音频文件大小限制为 10MB
- 仅支持 WAV 格式音频文件
- 音频采样率建议为 16kHz

## 使用示例

使用 curl 发送请求：

```typescript
import { NextResponse } from 'next/server';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: '没有找到音频文件' },
        { status: 400 }
      );
    }

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    console.log('音频文件信息：');
    console.log('文件大小：', buffer.length, 'bytes');
    console.log('文件类型：', audioFile.type);
    
    // 解析 WAV 头部信息
    const sampleRate = buffer.readUInt32LE(24);
    const audioData = buffer.slice(44); // 跳过 44 字节的 WAV 头

    // 将音频数据转换为 Float32Array
    const float32Samples = new Float32Array(audioData.length / 2);
    for (let i = 0; i < float32Samples.length; i++) {
      float32Samples[i] = audioData.readInt16LE(i * 2) / 32768.0;
    }
    
    console.log('音频数据信息：');
    console.log('采样率：', sampleRate);
    console.log('采样数量：', float32Samples.length);
    console.log('前10个采样值：', Array.from(float32Samples.slice(0, 10)));

    // 发送到 ASR 服务
    const asrFormData = new FormData();
    asrFormData.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'audio.wav');

    const text = await fetch('http://localhost:3002/asr', {
      method: 'POST',
      body: asrFormData,
      // 添加超时设置
      signal: AbortSignal.timeout(10000), // 10秒超时
      // 禁用自动压缩
      headers: {
        'Accept-Encoding': 'identity'
      }
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!data.success) {
        throw new Error(data.error || '语音识别失败');
      }
      return data.text;
    });
    
    return NextResponse.json({ text });
  } catch (error) {
    console.error('语音转文字失败:', error);
    return NextResponse.json(
      { error: '语音转文字失败' },
      { status: 500 }
    );
  }
} 
```

## 错误处理

服务器会处理以下错误情况：
- 文件大小超过限制
- 未收到音频文件
- 音频处理失败

## 目录结构

```
.
├── server.js          # 主服务器文件
├── uploads/           # 音频文件上传目录
└── README.md         # 项目文档
```