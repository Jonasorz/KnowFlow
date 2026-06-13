import { appendFileSync, existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function logDebug(message: string) {
  if (process.env.KNOWFLOW_DEBUG !== 'true') return;

  try {
    const logPath = join(process.cwd(), 'debug_podcast.log');
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch (e) {
    console.error('Failed to write to debug_podcast.log:', e);
  }
}

/**
 * Generate a highly detailed, realistic, simulated transcript
 * based on the podcast Shownotes. Each paragraph is assigned a clickable timestamp.
 */
/**
 * Extract guest name from podcast title
 */
function extractGuestName(title: string): string {
  const pattern = /(?:和|与|对话|对|访谈)([^的与和聊访第之\s，。：:]{2,5})(?:的|聊|和|与|访谈|\s|$)/i;
  const match = title.match(pattern);
  if (match && match[1]) {
    const name = match[1].trim();
    const excludeList = ['投资', '创业', '商业', '如何', '中国', '世界', '我们', '时代', '行业', '大模型', '开发', '技术', '产品', '项目'];
    if (!excludeList.includes(name) && name.length <= 5) {
      return name;
    }
  }
  return '嘉宾';
}

/**
 * Clean up ASR music and silence hallucinations, returning whether it is music
 * and the cleaned text.
 */
function cleanSentenceText(text: string): { isMusic: boolean; cleanText: string } {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return { isMusic: true, cleanText: '🎵 [片头/背景音乐]' };
  }

  // Check if it consists only of punctuation, spaces, or numbers (silence/hallucinations)
  const onlyPunctuationOrNumbers = /^[\s\d\.,\?\!，。？！、；：“”‘’（）【】［］《》「」『』\-—~_#@%&\*\+=\[\]]*$/.test(trimmed);
  if (onlyPunctuationOrNumbers) {
    return { isMusic: true, cleanText: '🎵 [片头/背景音乐]' };
  }
  
  const musicPatterns = [
    /sous\s*-?\s*titr/i,
    /subtit(?:le|ling)/i,
    /sync\s*&\s*correct/i,
    /thank\s*you\s*for\s*watching/i,
    /correct(?:ed)?\s*by/i,
    /字幕(?:组|由)/i,
    /^[\s\.,\?\!，。？！]*un(?:[0-9]*)?[\s\.,\?\!，。？！]*$/i,
    /^[\s\.,\?\!，。？！]*[a-zA-Z\d\s]?(?:lrc|lyric)[a-zA-Z\d\s]?[\s\.,\?\!，。？！]*$/i,
    /^[片头]?音乐/i,
    /^[片尾]?音乐/i,
    /谢谢(?:大家)?(?:的)?收看/i,
    /请(?:大家)?(?:继续)?收看/i
  ];

  const isMusic = musicPatterns.some(pattern => pattern.test(trimmed)) || 
                  (trimmed.toLowerCase().includes('music') && trimmed.length < 15) ||
                  (trimmed.includes('音乐') && trimmed.length < 10);
                  
  if (isMusic) {
    return { isMusic: true, cleanText: '🎵 [片头/背景音乐]' };
  }
  
  return { isMusic: false, cleanText: trimmed };
}

/**
 * Format seconds to a timestamp string [HH:MM:SS] or [MM:SS]
 */
function formatSecondsToTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
  }
  return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
}


/**
 * Generate a highly detailed, realistic, simulated transcript
 * based on the podcast Shownotes. Each paragraph is assigned a clickable timestamp.
 */
export function generateSimulatedTranscript(
  title: string,
  shownotes: string,
  duration?: number
): { text: string; html: string } {
  const cleanNotes = shownotes || '本期节目由主播精心录制，暂无详细文字介绍。';
  
  // Clean up HTML tags but preserve line breaks
  const textWithLineBreaks = cleanNotes
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  
  const totalDuration = duration && duration > 0 ? duration : 1800; // default 30 minutes
  
  interface OutlineChapter {
    time: number;
    title: string;
  }
  const chapters: OutlineChapter[] = [];

  function parseDurationString(h: string, m: string, s?: string): number {
    const val1 = parseInt(h, 10);
    const val2 = parseInt(m, 10);
    if (s !== undefined) {
      const val3 = parseInt(s, 10);
      return val1 * 3600 + val2 * 60 + val3;
    }
    return val1 * 60 + val2;
  }

  // 1. Try to extract timeline chapters/outlines from the text
  const tsRegex = /(?:^|\s|\[)(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g;
  const matches: { index: number; length: number; time: number }[] = [];
  let tsMatch;
  
  while ((tsMatch = tsRegex.exec(textWithLineBreaks)) !== null) {
    const fullMatchText = tsMatch[0];
    const p1 = tsMatch[1];
    const p2 = tsMatch[2];
    const p3 = tsMatch[3];
    const seconds = parseDurationString(p1, p2, p3);
    
    matches.push({
      index: tsMatch.index,
      length: fullMatchText.length,
      time: seconds
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIndex = current.index + current.length;
    const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : textWithLineBreaks.length;
    
    let segmentText = textWithLineBreaks.substring(startIndex, endIndex).trim();
    segmentText = segmentText.split('\n')[0].trim();
    segmentText = segmentText.replace(/^[-—：:\s]+/, '').trim();
    
    if (segmentText.length > 0) {
      chapters.push({
        time: current.time,
        title: segmentText
      });
    }
  }

  // 2. Fallback: if no timeline chapters are parsed, split raw text by paragraph and assign incremental timestamps
  const rawLines = textWithLineBreaks
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 5 && !line.toLowerCase().includes('outline') && !line.includes('时间线') && !line.includes('links') && !line.includes('disclaimer') && !line.includes('contact'));

  if (chapters.length === 0 && rawLines.length > 0) {
    const count = Math.min(rawLines.length, 10);
    const step = Math.floor(totalDuration / (count + 1));
    for (let i = 0; i < count; i++) {
      chapters.push({
        time: (i + 1) * step,
        title: rawLines[i].slice(0, 50) + (rawLines[i].length > 50 ? '...' : '')
      });
    }
  }

  if (chapters.length === 0) {
    // Hard fallback if no text found at all
    chapters.push({ time: Math.floor(totalDuration * 0.1), title: '主讲内容分享' });
    chapters.push({ time: Math.floor(totalDuration * 0.4), title: '关键要点梳理' });
    chapters.push({ time: Math.floor(totalDuration * 0.7), title: '问答与总结' });
  }

  // Sort and remove duplicates or too close timestamps
  chapters.sort((a, b) => a.time - b.time);
  
  const finalChapters: OutlineChapter[] = [];
  if (chapters[0].time > 10) {
    finalChapters.push({ time: 0, title: '开场介绍与背景' });
  }
  
  // Filter out any timestamps that exceed totalDuration
  chapters.forEach(c => {
    if (c.time < totalDuration) {
      // Ensure we don't have duplicate times
      if (!finalChapters.some(fc => fc.time === c.time)) {
        finalChapters.push(c);
      }
    }
  });

  // Calculate end times for each chapter
  interface ChapterWithEnd extends OutlineChapter {
    endTime: number;
  }
  const chaptersWithEnd: ChapterWithEnd[] = [];
  for (let i = 0; i < finalChapters.length; i++) {
    const current = finalChapters[i];
    const nextTime = (i + 1 < finalChapters.length) ? finalChapters[i + 1].time : totalDuration;
    chaptersWithEnd.push({
      time: current.time,
      title: current.title,
      endTime: Math.max(nextTime, current.time + 30) // ensure at least 30s
    });
  }

  const textLines: string[] = [];
  const htmlLines: string[] = [];
  
  // Extract guest name and set roles
  const guestName = extractGuestName(title);
  const guestRole = guestName !== '嘉宾' ? `嘉宾 ${guestName}` : '嘉宾';
  const roles = ['主持人', guestRole];

  // Conversation template pools
  const hostOpeners = [
    "好的，我们进入下一个非常重要的板块，就是：{topic}。关于这部分，很多听众之前也一直在后台留言问起。",
    "下面我们来聊聊：{topic}。这其实也是我们这期节目非常精彩的一个部分。",
    "接下来的这个话题我觉得很有启发性，叫：{topic}。您是怎么看待这个问题的？",
    "我们刚才聊完了前面的背景，现在切入到：{topic}。这里面有哪些关键的决策或者转折点？",
    "在 {topic} 这个阶段，有什么让您觉得特别难忘，或者说最反直觉的事情吗？",
    "那么接下来，我们来深入讨论一下：{topic}。这对于行业或者公司未来的发展意味着什么？",
    "回到我们的核心主题，关于 {topic}，很多人的第一反应可能是觉得顺理成章，但实际做起来非常复杂吧？"
  ];

  const guestResponses = [
    "对，{topic} 确实是一个很关键的节点。其实我们当时在做这件事的时候，团队面临了非常大的压力 and 不确定性。主要的挑战在于，这在行业内没有太多现成的路可以走，我们完全是在摸着石头过河。",
    "关于 {topic}，我的看法是，这不仅仅是一个战术或者产品层面的调整，它更是一次认知上的升级。如果你不能在底层逻辑上想清楚，做再多的执行可能都是在错误的方向上浪费时间。",
    "其实 {topic} 背后折射出的是整个大环境和技术周期的剧烈变化。在过去，可能很多做法都是行之有效的；但在这个技术剧变的关口，原有的优势甚至可能变成包袱，所以我们必须要有新的解法。",
    "我觉得 {topic} 是一个非常好的切入点。如果从一个更长的维度来看，我们现在的探索虽然付出了不少代价，但每一次尝试都让我们对这件事情的边界看得更加清晰，这本身就是极具价值的。",
    "针对 {topic}，我们内部其实经历过非常激烈的争论。最终我们达成共识，在这个方向上我们必须下更大的赌注，因为如果不拥抱这个未来的变化，我们就没有任何胜率可言了。",
    "这也是很多人经常问我的一个问题。关于 {topic}，核心还是要看你的第一性原理是什么。如果从用户的真实体验或者效率提升出发，很多复杂的决策其实就会变得非常纯粹和简单。"
  ];

  const hostFollowups = [
    "明白。那在这个过程中，您觉得最艰难的决策时刻是什么？或者说最让您感到孤独的瞬间是？",
    "这确实很需要勇气。那当您面对身边绝大多数人的怀疑或者不同意见时，您是怎么让自己坚定信念的？",
    "这听上去很反直觉。那在这个商业和技术逻辑下，对于普通的创业者或者行业从业者，有什么可以分享的避坑指南吗？",
    "这其实就涉及到咱们刚才说到的认知边界了。在这个过程中，您个人的心态和思维方式发生了怎样的演变？",
    "确实是这样。那能不能结合一个具体的细节，给我们讲讲当时发生的一些细节故事？"
  ];

  const guestElaborations = [
    "最孤独的时刻，往往就是你明知道一个决定是对的，但它短期内会带来阵痛，而且你无法向所有人完美解释的时候。你必须自己抗下所有的压力，然后用结果去证明它。",
    "我觉得最关键的还是要保持对技术和市场的敬畏，同时要敢于自我否定。如果你一直守着过去的成功路径不放，那么在新一轮变革到来的时候，被淘汰只是时间问题。",
    "我的建议是，永远不要去追逐那些虚幻的、没有被真实用户需求支撑的概念。找到自己真正有壁垒、能持续创造价值的事情，哪怕起步慢一点，但只要方向对，时间就是你的朋友。",
    "我个人的心态其实变得比以前更平和了。过去可能会有很多宏大的野心和包袱，但现在我更关注每天具体的进展，关注我们是不是在踏踏实实地解决用户的痛点，团队是不是在不断成长。",
    "细节其实很有意思。当时我们连续开闭门会，大家都吵得很凶，甚至有一些非常情绪化的碰撞。但我觉得这就是真实创业的魅力，大家都是为了把事情做好，最后达成一致后，每个人都能全力以赴。"
  ];

  // Add intro
  const introText = `欢迎收听本期节目。今天我们聊的话题是《${title}》。在正式探讨前，让我们先快速浏览一下这期节目的核心大纲和主要背景。`;
  textLines.push(`[00:00] 主持人: ${introText}`);
  htmlLines.push(`
    <div class="mb-4 flex flex-col gap-1.5 p-3 pl-4 rounded-xl hover:bg-muted/30 transition-all border border-l-4 border-transparent hover:border-border/30" data-segment-time="0">
      <div class="flex items-center justify-between text-xs font-semibold text-muted-foreground select-none">
        <div class="flex items-center gap-1.5">
          <span class="font-mono text-primary cursor-pointer hover:underline" data-time="0">[00:00]</span>
          <span>•</span>
          <span class="text-foreground/80">主持人</span>
        </div>
      </div>
      <p class="text-xs text-foreground/90 leading-relaxed mt-0.5">${introText}</p>
    </div>
  `);

  // Generate turns for each chapter
  chaptersWithEnd.forEach((c, cIdx) => {
    const isIntroChapter = c.time === 0;
    const numTurns = isIntroChapter ? 2 : 4;
    
    for (let j = 0; j < numTurns; j++) {
      const turnTime = Math.floor(c.time + (j * (c.endTime - c.time)) / numTurns);
      if (turnTime === 0 && !isIntroChapter) continue;
      
      const role = roles[j % 2];
      
      // Select template text
      let dialogueText = '';
      if (j === 0) {
        const template = hostOpeners[cIdx % hostOpeners.length];
        dialogueText = template.replace(/{topic}/g, c.title);
      } else if (j === 1) {
        const template = guestResponses[(cIdx + 1) % guestResponses.length];
        dialogueText = template.replace(/{topic}/g, c.title);
      } else if (j === 2) {
        dialogueText = hostFollowups[(cIdx + 2) % hostFollowups.length];
      } else {
        dialogueText = guestElaborations[(cIdx + 3) % guestElaborations.length];
      }

      // Format time string
      const timeStr = formatSecondsToTimestamp(turnTime);

      textLines.push(`${timeStr} ${role}: ${dialogueText}`);
      htmlLines.push(`
        <div class="mb-4 flex flex-col gap-1.5 p-3 pl-4 rounded-xl hover:bg-muted/30 transition-all border border-l-4 border-transparent hover:border-border/30" data-segment-time="${turnTime}">
          <div class="flex items-center justify-between text-xs font-semibold text-muted-foreground select-none">
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-primary cursor-pointer hover:underline" data-time="${turnTime}">${timeStr}</span>
              <span>•</span>
              <span class="text-foreground/80">${role}</span>
            </div>
          </div>
          <p class="text-xs text-foreground/90 leading-relaxed mt-0.5">${dialogueText}</p>
        </div>
      `);
    }
  });

  // Add outro
  const outroTime = Math.max(totalDuration - 10, finalChapters[finalChapters.length - 1].time + 10);
  const outroTimeStr = formatSecondsToTimestamp(outroTime);
  const outroText = `感谢大家的收听，本期关于《${title}》的深入分享就到这里。如果你喜欢我们的内容，欢迎订阅和转发，我们下期节目再见！`;
  textLines.push(`${outroTimeStr} 主持人: ${outroText}`);
  htmlLines.push(`
    <div class="mb-4 flex flex-col gap-1.5 p-3 pl-4 rounded-xl hover:bg-muted/30 transition-all border border-l-4 border-transparent hover:border-border/30" data-segment-time="${outroTime}">
      <div class="flex items-center justify-between text-xs font-semibold text-muted-foreground select-none">
        <div class="flex items-center gap-1.5">
          <span class="font-mono text-primary cursor-pointer hover:underline" data-time="${outroTime}">${outroTimeStr}</span>
          <span>•</span>
          <span class="text-foreground/80">主持人</span>
        </div>
      </div>
      <p class="text-xs text-foreground/90 leading-relaxed mt-0.5">${outroText}</p>
    </div>
  `);
  return {
    text: textLines.join('\n'),
    html: `<div class="podcast-transcript space-y-2 py-2" data-simulated="true">${htmlLines.join('\n')}</div>`
  };
}

/**
 * Helper to download and compress audio using ffmpeg.
 * Returns paths to temporary original and compressed files, and a success flag.
 */
async function downloadAndCompressAudio(
  audioUrl: string,
  tempDir: string
): Promise<{ originalFile: string; compressedFile: string; success: boolean }> {
  const originalFile = join(tempDir, `original_${uuidv4()}.mp3`);
  const compressedFile = join(tempDir, `compressed_${uuidv4()}.mp3`);

  try {
    if (!existsSync(tempDir)) {
      await fs.mkdir(tempDir, { recursive: true });
    }

    logDebug(`[Compressor] Downloading audio file to temporary space: ${audioUrl}`);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio file: ${audioRes.status}`);
    }
    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(originalFile, buffer);

    logDebug(`[Compressor] Audio downloaded. Size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

    // Compress using ffmpeg
    logDebug(`[Compressor] Compressing audio with ffmpeg to 16kbps mono...`);
    try {
      await runCommand(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-y',
        '-i',
        originalFile,
        '-acodec',
        'libmp3lame',
        '-ab',
        '16k',
        '-ar',
        '16000',
        '-ac',
        '1',
        compressedFile,
      ]);
      const compressedStats = await fs.stat(compressedFile);
      const compressedSize = compressedStats.size;
      logDebug(`[Compressor] Compression successful! Compressed size: ${(compressedSize / (1024 * 1024)).toFixed(2)} MB`);
      return { originalFile, compressedFile, success: true };
    } catch (e) {
      logDebug(`[Compressor] ffmpeg compression failed: ${e instanceof Error ? e.message : String(e)}`);
      // If original file is small enough, try using original file directly
      if (buffer.length < 24 * 1024 * 1024) {
        logDebug('[Compressor] Original file is under 24MB, using original file directly.');
        await fs.writeFile(compressedFile, buffer);
        return { originalFile, compressedFile, success: true };
      } else {
        throw new Error(`Original file is over 24MB and compression failed.`);
      }
    }
  } catch (err) {
    logDebug(`[Compressor] downloadAndCompressAudio failed: ${err instanceof Error ? err.message : String(err)}`);
    return { originalFile, compressedFile, success: false };
  }
}

/**
 * Transcribe podcast audio using Alibaba Cloud DashScope (通义听悟 / Paraformer-v2) API.
 * Uploads local audio file to temporary OSS bucket using policy.
 */
async function transcribeWithDashScope(
  localFilePath: string,
  apiKey: string,
  title: string
): Promise<{ text: string; html: string }> {
  logDebug(`[DashScope] Starting transcription for local file: ${localFilePath}`);

  // 1. Prepare file buffer and blob
  const filename = `temp_audio_${uuidv4()}.mp3`;
  const fileBuffer = await fs.readFile(localFilePath);
  const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });

  let fileUrl = '';
  let isOssUpload = false;

  // Try 1: Official DashScope OSS Upload Policy (Fast, secure, native)
  try {
    logDebug(`[DashScope] Fetching official OSS upload policy...`);
    const policyRes = await fetch('https://dashscope.aliyuncs.com/api/v1/uploads?action=getPolicy&model=paraformer-v2', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!policyRes.ok) {
      const errText = await policyRes.text();
      throw new Error(`Failed to get DashScope upload policy: ${errText}`);
    }

    const policyJson = await policyRes.json() as any;
    const policyData = policyJson.data;
    if (!policyData || !policyData.upload_host || !policyData.upload_dir) {
      throw new Error(`Invalid policy response structure: ${JSON.stringify(policyJson)}`);
    }

    logDebug(`[DashScope] Upload policy retrieved. Host: ${policyData.upload_host}, Dir: ${policyData.upload_dir}`);

    const formData = new FormData();
    formData.append('OSSAccessKeyId', policyData.oss_access_key_id);
    formData.append('policy', policyData.policy);
    formData.append('Signature', policyData.signature);
    formData.append('key', `${policyData.upload_dir}/${filename}`);
    if (policyData.x_oss_object_acl) {
      formData.append('x-oss-object-acl', policyData.x_oss_object_acl);
    }
    if (policyData.x_oss_forbid_overwrite) {
      formData.append('x-oss-forbid-overwrite', policyData.x_oss_forbid_overwrite);
    }
    formData.append('success_action_status', '200');
    // File must be the last field in the form data
    formData.append('file', blob, filename);

    logDebug(`[DashScope] Uploading file to official OSS...`);
    const uploadRes = await fetch(policyData.upload_host, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload file to DashScope OSS: ${errText}`);
    }

    fileUrl = `oss://${policyData.upload_dir}/${filename}`;
    isOssUpload = true;
    logDebug(`[DashScope] File uploaded successfully to official OSS. OSS URL: ${fileUrl}`);
  } catch (err) {
    logDebug(`[DashScope] Official OSS upload failed: ${err instanceof Error ? err.message : String(err)}. Checking whether public temporary upload fallbacks are enabled...`);

    if (process.env.KNOWFLOW_ALLOW_PUBLIC_TRANSCRIPTION_UPLOADS !== 'true') {
      throw new Error(
        'DashScope official upload failed. Temporary public transcription upload fallbacks are disabled by default. ' +
        'Set KNOWFLOW_ALLOW_PUBLIC_TRANSCRIPTION_UPLOADS=true only if you understand that audio files may be uploaded to third-party public temporary file hosts.'
      );
    }

    // Try fallback temporary public hosting services
    const formData = new FormData();
    formData.append('file', blob, filename);

    // Try 1.1: transfer.sh (highly reliable CLI upload, raw PUT, clean direct URL)
    try {
      logDebug(`[DashScope] Trying upload to transfer.sh...`);
      const uploadRes = await fetch(`https://transfer.sh/${filename}`, {
        method: 'PUT',
        body: fileBuffer
      });
      if (!uploadRes.ok) {
        throw new Error(`transfer.sh status: ${uploadRes.status}`);
      }
      const textUrl = await uploadRes.text();
      fileUrl = textUrl.trim();
      if (!fileUrl.startsWith('http')) {
        throw new Error(`Invalid response from transfer.sh: ${fileUrl}`);
      }
      logDebug(`[DashScope] File uploaded successfully to transfer.sh. Public URL: ${fileUrl}`);
    } catch (fallbackErr) {
      logDebug(`[DashScope] Upload to transfer.sh failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}. Trying fallback tmpfiles.org...`);
      
      // Try 1.2: tmpfiles.org
      try {
        const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
          method: 'POST',
          body: formData
        });
        if (!uploadRes.ok) {
          throw new Error(`tmpfiles.org status: ${uploadRes.status}`);
        }
        const uploadJson = await uploadRes.json() as any;
        const rawUrl = uploadJson.data?.url;
        if (!rawUrl) {
          throw new Error(`Invalid response from tmpfiles.org: ${JSON.stringify(uploadJson)}`);
        }
        fileUrl = rawUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        logDebug(`[DashScope] File uploaded successfully to tmpfiles.org. Public URL: ${fileUrl}`);
      } catch (tmpfilesErr) {
        logDebug(`[DashScope] Upload to tmpfiles.org failed: ${tmpfilesErr instanceof Error ? tmpfilesErr.message : String(tmpfilesErr)}. Trying fallback tmpfile.link...`);
        
        // Try 1.3: tmpfile.link
        try {
          const fallbackRes = await fetch('https://tmpfile.link/api/upload', {
            method: 'POST',
            body: formData
          });
          if (!fallbackRes.ok) {
            throw new Error(`tmpfile.link status: ${fallbackRes.status}`);
          }
          const fallbackJson = await fallbackRes.json() as any;
          fileUrl = fallbackJson.downloadLink;
          if (!fileUrl) {
            throw new Error(`Invalid response from tmpfile.link: ${JSON.stringify(fallbackJson)}`);
          }
          logDebug(`[DashScope] File uploaded successfully to tmpfile.link. Public URL: ${fileUrl}`);
        } catch (lastErr) {
          throw new Error(`All temporary file upload services failed. Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
        }
      }
    }
  }

  // 2. Submit transcription task to DashScope ASR
  logDebug(`[DashScope] Submitting transcription task with URL: ${fileUrl}`);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-Async': 'enable'
  };

  // If using native oss:// URL, we MUST include X-DashScope-OssResourceResolve: enable header
  if (isOssUpload) {
    headers['X-DashScope-OssResourceResolve'] = 'enable';
  }

  const submitRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'paraformer-v2',
      input: {
        file_urls: [fileUrl]
      },
      parameters: {
        diarization_enabled: true
      }
    })
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`DashScope task submit error: ${errText}`);
  }

  const submitJson = await submitRes.json() as any;
  const taskId = submitJson.output?.task_id;
  if (!taskId) {
    throw new Error(`Failed to submit task: task_id is empty. Response: ${JSON.stringify(submitJson)}`);
  }

  logDebug(`[DashScope] Task submitted successfully. task_id: ${taskId}`);

  // Poll for status
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (120 * 5s)
  let resultUrl = '';

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    logDebug(`[DashScope] Polling task status (attempt ${attempts})...`);
    const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!statusRes.ok) {
      logDebug(`[DashScope] Polling failed: ${statusRes.statusText}`);
      continue;
    }

    const statusJson = await statusRes.json() as any;
    const taskStatus = statusJson.output?.task_status;
    logDebug(`[DashScope] Task status: ${taskStatus}`);

    if (taskStatus === 'SUCCEEDED') {
      logDebug(`[DashScope] Task SUCCEEDED. Full Response: ${JSON.stringify(statusJson)}`);
      const results = statusJson.output?.results;
      const result = statusJson.output?.result;
      
      if (results) {
        if (Array.isArray(results)) {
          if (results.length > 0) {
            resultUrl = results[0].transcription_url || '';
          }
        } else if (typeof results === 'object') {
          resultUrl = results.transcription_url || '';
        }
      }
      
      if (!resultUrl && result) {
        if (typeof result === 'object') {
          resultUrl = result.transcription_url || '';
        }
      }
      
      if (!resultUrl && statusJson.output?.transcription_url) {
        resultUrl = statusJson.output.transcription_url;
      }
      break;
    } else if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
      throw new Error(`DashScope task failed with status: ${taskStatus}. Output: ${JSON.stringify(statusJson.output)}`);
    }
  }

  if (!resultUrl) {
    throw new Error(`Failed to get transcription result URL or task timed out.`);
  }

  logDebug(`[DashScope] Task succeeded. Fetching transcription JSON from: ${resultUrl}`);

  const fileRes = await fetch(resultUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to fetch transcription result file: ${fileRes.statusText}`);
  }

  const resultData = await fileRes.json() as any;
  logDebug(`[DashScope] Result JSON loaded successfully.`);

  const transcripts = resultData.transcripts || [];
  const textLines: string[] = [];
  const htmlLines: string[] = [];

  const guestName = extractGuestName(title);
  const guestRole = guestName !== '嘉宾' ? `嘉宾 ${guestName}` : '嘉宾';
  const speakerMap = new Map<string, string>();

  transcripts.forEach((transcript: any) => {
    const sentences = transcript.sentences || [];
    sentences.forEach((sentence: any) => {
      const beginTimeMs = sentence.begin_time !== undefined ? sentence.begin_time : (sentence.start_time !== undefined ? sentence.start_time : 0);
      const startSeconds = Math.floor(beginTimeMs / 1000);

      const hours = Math.floor(startSeconds / 3600);
      const minutes = Math.floor((startSeconds % 3600) / 60);
      const seconds = startSeconds % 60;
      let timeStr = '';
      if (hours > 0) {
        timeStr = `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      } else {
        timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      }

      const rawText = sentence.text || '';
      const { isMusic, cleanText } = cleanSentenceText(rawText);

      let role = '';
      if (isMusic) {
        role = '🎵 音乐';
      } else {
        const speakerId = sentence.speaker_id !== undefined ? String(sentence.speaker_id) : '0';
        if (!speakerMap.has(speakerId)) {
          if (speakerMap.size === 0) {
            speakerMap.set(speakerId, '主持人');
          } else if (speakerMap.size === 1) {
            speakerMap.set(speakerId, guestRole);
          } else {
            speakerMap.set(speakerId, `发言人 ${speakerMap.size + 1}`);
          }
        }
        role = speakerMap.get(speakerId) || '发言人';
      }

      textLines.push(`${timeStr} ${role}: ${cleanText}`);
      htmlLines.push(`
        <div class="mb-4 flex flex-col gap-1.5 p-3 pl-4 rounded-xl hover:bg-muted/30 transition-all border border-l-4 border-transparent hover:border-border/30" data-segment-time="${startSeconds}">
          <div class="flex items-center justify-between text-xs font-semibold text-muted-foreground select-none">
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-primary cursor-pointer hover:underline" data-time="${startSeconds}">${timeStr}</span>
              <span>•</span>
              <span class="text-foreground/80">${role}</span>
            </div>
          </div>
          <p class="text-xs text-foreground/90 leading-relaxed mt-0.5">${cleanText}</p>
        </div>
      `);
    });
  });

  if (htmlLines.length === 0) {
    throw new Error('No sentences found in transcription result.');
  }

  return {
    text: textLines.join('\n'),
    html: `<div class="podcast-transcript space-y-2 py-2">${htmlLines.join('\n')}</div>`
  };
}

/**
 * Transcribe a podcast audio URL.
 * Requires a configured transcription provider. Simulated transcripts are kept
 * for tests or explicit internal use only because they can be mistaken for real ASR.
 */
export async function transcribePodcast(
  audioUrl: string,
  apiKey: string | undefined,
  title: string,
  shownotes: string,
  duration?: number,
  apiBaseUrl?: string,
  dashscopeApiKey?: string
): Promise<{ text: string; html: string }> {
  logDebug(`Transcribing podcast: ${title}, URL: ${audioUrl}, API Key configured: ${!!apiKey}, DashScope Key configured: ${!!dashscopeApiKey}`);

  if (!audioUrl) {
    throw new Error('Audio URL is missing for this episode.');
  }

  if (!dashscopeApiKey && !apiKey) {
    throw new Error('未配置转写 API。请先在 Settings 中配置通义听悟 (DashScope) API Key 后再生成真实逐字稿。');
  }

  const tempDir = join(process.cwd(), 'data', 'temp_transcribe');
  let originalFile = '';
  let compressedFile = '';
  let downloadSuccess = false;

  try {
    // If we have either dashscopeApiKey or openai apiKey, we need to download and compress the file
    if (dashscopeApiKey || apiKey) {
      const compressResult = await downloadAndCompressAudio(audioUrl, tempDir);
      originalFile = compressResult.originalFile;
      compressedFile = compressResult.compressedFile;
      downloadSuccess = compressResult.success;
    }

    // 1. Prioritize DashScope ASR
    if (dashscopeApiKey && downloadSuccess && compressedFile) {
      try {
        logDebug('Found dashscopeApiKey, prioritizing Alibaba Cloud DashScope (通义听悟) transcription.');
        const result = await transcribeWithDashScope(compressedFile, dashscopeApiKey, title);
        logDebug('DashScope transcription completed successfully!');
        return result;
      } catch (err) {
        logDebug(`DashScope transcription failed: ${err instanceof Error ? err.message : String(err)}. Trying Whisper if configured.`);
      }
    }

    // 2. Fallback to OpenAI Whisper
    if (apiKey && downloadSuccess && compressedFile) {
      try {
        logDebug('Attempting OpenAI Whisper transcription on compressed audio...');
        const compressedBuffer = await fs.readFile(compressedFile);
        
        // Prepare FormData
        const formData = new FormData();
        const blob = new Blob([compressedBuffer], { type: 'audio/mpeg' });
        formData.append('file', blob, 'audio.mp3');
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');

        const whisperBaseUrl = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';
        logDebug(`Whisper API endpoint URL: ${whisperBaseUrl}/audio/transcriptions`);
        const whisperRes = await fetch(`${whisperBaseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (!whisperRes.ok) {
          const errText = await whisperRes.text();
          throw new Error(`OpenAI Whisper API error: ${errText}`);
        }

        const whisperJson = await whisperRes.json() as any;
        logDebug('Whisper transcription successful!');

        // Format Whisper JSON output into standard HTML with timestamps and speakers
        const segments = whisperJson.segments || [];
        const textLines: string[] = [];
        const htmlLines: string[] = [];

        // Extract guest name and set roles
        const guestName = extractGuestName(title);
        const guestRole = guestName !== '嘉宾' ? `嘉宾 ${guestName}` : '嘉宾';
        const roles = ['主持人', guestRole];

        if (segments.length > 0) {
          segments.forEach((seg: any, index: number) => {
            const start = Math.floor(seg.start);
            
            // Dynamic HH:MM:SS / MM:SS formatting
            const hours = Math.floor(start / 3600);
            const minutes = Math.floor((start % 3600) / 60);
            const seconds = start % 60;
            let timeStr = '';
            if (hours > 0) {
              timeStr = `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
            } else {
              timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
            }

            const rawText = seg.text || '';
            const { isMusic, cleanText } = cleanSentenceText(rawText);

            let role = '';
            if (isMusic) {
              role = '🎵 音乐';
            } else {
              // Alternating speaker roles for realistic dialogue tags
              role = roles[index % roles.length];
            }
            
            textLines.push(`${timeStr} ${role}: ${cleanText}`);
            htmlLines.push(`
              <div class="mb-4 flex flex-col gap-1.5 p-3 pl-4 rounded-xl hover:bg-muted/30 transition-all border border-l-4 border-transparent hover:border-border/30" data-segment-time="${start}">
                <div class="flex items-center justify-between text-xs font-semibold text-muted-foreground select-none">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-primary cursor-pointer hover:underline" data-time="${start}">${timeStr}</span>
                    <span>•</span>
                    <span class="text-foreground/80">${role}</span>
                  </div>
                </div>
                <p class="text-xs text-foreground/90 leading-relaxed mt-0.5">${cleanText}</p>
              </div>
            `);
          });
          
          return {
            text: textLines.join('\n'),
            html: `<div class="podcast-transcript space-y-2 py-2">${htmlLines.join('\n')}</div>`
          };
        } else {
          const text = whisperJson.text || '';
          return {
            text,
            html: `<div class="podcast-transcript space-y-2 py-2"><p class="text-sm p-4">${text}</p></div>`
          };
        }
      } catch (err) {
        logDebug(`Whisper transcription failed: ${err instanceof Error ? err.message : String(err)}.`);
      }
    }

    throw new Error('转写失败。请检查转写 API Key、音频链接和 ffmpeg 配置后重试。');

  } catch (err) {
    logDebug(`Transcription failed: ${err instanceof Error ? err.message : String(err)}.`);
    throw err;
  } finally {
    // Delete temporary files
    try {
      if (originalFile && existsSync(originalFile)) await fs.unlink(originalFile);
    } catch (e) {}
    try {
      if (compressedFile && existsSync(compressedFile)) await fs.unlink(compressedFile);
    } catch (e) {}
  }
}
