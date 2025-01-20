// Require the framework and instantiate it
const sherpa_onnx = require('sherpa-onnx-node');
const fastify = require('fastify')({ 
  logger: true,
  bodyLimit: 10 * 1024 * 1024
})

// 添加 multipart 支持
fastify.register(require('@fastify/multipart'), {
  limits: {
    fieldSize: 10 * 1024 * 1024 // 10MB
  }
});

// Declare a route
fastify.get('/', function handler (request, reply) {
  reply.send({ hello: 'world' })
})

// 添加所需的 fs 模块
const fs = require('fs');
const path = require('path');



// 修改 ASR 接口以接收文件上传
fastify.post('/asr', async (request, reply) => {
  try {
    const data = await request.file();
    if (!data) {
      throw new Error('没有收到音频文件');
    }

    // 使用流式处理
    const chunks = [];
    let totalSize = 0;
    
    for await (const chunk of data.file) {
      chunks.push(chunk);
      totalSize += chunk.length;
      // 如果文件太大，提前终止
      if (totalSize > 10 * 1024 * 1024) { // 10MB 限制
        throw new Error('文件太大');
      }
    }
    
    const buffer = Buffer.concat(chunks);

    // 保存文件（异步方式）
    const uploadDir = path.join(__dirname, 'uploads');
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const fileName = `audio_${Date.now()}.wav`;
    fs.promises.writeFile(path.join(uploadDir, fileName), buffer).catch(console.error);

    // 解析 WAV 文件头
    const sampleRate = buffer.readUInt32LE(24);
    const audioData = buffer.slice(44); // 跳过 44 字节的 WAV 头

    // 转换为 Float32Array
    const float32Samples = new Float32Array(audioData.length / 2);
    for (let i = 0; i < float32Samples.length; i++) {
      float32Samples[i] = audioData.readInt16LE(i * 2) / 32768.0;
    }

    // 进行语音识别
    const stream = recognizer.createStream();
    stream.acceptWaveform({
      sampleRate: sampleRate,
      samples: float32Samples
    });

    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    console.log('ASR结果:', result);
    
    return { 
      success: true, 
      text: result
    };
    
  } catch (error) {
    console.error('处理失败:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// 启动服务器
const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

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

// 创建识别器实例
const recognizer = new sherpa_onnx.OfflineRecognizer(config);

start()