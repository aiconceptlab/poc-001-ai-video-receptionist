'use client';
/* oxlint-disable jsx-a11y/media-has-caption -- WebRTC has no static caption track; the adjacent live transcript provides the spoken text. */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AgentManager } from '@d-id/client-sdk';
import {
  ArrowUpRight,
  ArrowUp,
  AudioLines,
  Check,
  FlaskConical,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Volume2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import faq from '@/knowledge/faq.json';
import { previewAnswer } from '@/lib/preview.mjs';

type Config = {
  live: boolean;
  agentId: string;
  clientKey: string;
  microphone: boolean;
};
type Line = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string | null;
};
type Status = 'loading' | 'ready' | 'connecting' | 'connected';
const hello: Line = {
  id: 'hello',
  role: 'assistant',
  content:
    'Hi, I’m Nova, your AI receptionist. Ask me about AI Concept Lab, or tell me what you’d like to build.',
};

export default function Receptionist() {
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [lines, setLines] = useState<Line[]>([hello]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [idleUrl, setIdleUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [error, setError] = useState('');
  const [needsPlay, setNeedsPlay] = useState(false);
  const [remaining, setRemaining] = useState(180);
  const [contactOpen, setContactOpen] = useState(false);
  const [interest, setInterest] = useState('');
  const [faqOpen, setFaqOpen] = useState(false);
  const manager = useRef<AgentManager | null>(null);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const microphone = useRef<MediaStream | null>(null);
  const attempt = useRef(0);
  const endOfMessages = useRef<HTMLDivElement>(null);
  const deadline = useRef(0);

  function stopMedia() {
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    setMicOn(false);
    setMicBusy(false);
    if (liveVideo.current) {
      liveVideo.current.pause();
      liveVideo.current.srcObject = null;
    }
    setSpeaking(false);
    setNeedsPlay(false);
  }

  async function endSession() {
    attempt.current += 1;
    const current = manager.current;
    manager.current = null;
    stopMedia();
    setStatus('ready');
    setBusy(false);
    if (current) {
      try {
        await current.disconnect();
      } catch {
        /* Local media is already stopped. */
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setConfig(await response.json());
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Could not load the receptionist. Refresh this page to try again.',
          );
      });
    return () => {
      controller.abort();
      attempt.current += 1;
      microphone.current?.getTracks().forEach((track) => track.stop());
      void manager.current?.disconnect().catch(() => {});
      manager.current = null;
    };
  }, []);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [lines, busy]);

  useEffect(() => {
    if (status !== 'connected') return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0) {
        void endSession();
        setError(
          'The three-minute demo has ended. You can start another conversation.',
        );
      }
    }, 1000);
    const onPageHide = () => {
      void endSession();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [status]);

  async function startSession() {
    if (!config?.live || status !== 'ready') return;
    setError('');
    setStatus('connecting');
    setLines([hello]);
    setIdleUrl('');
    setThumbnail('');
    const token = ++attempt.current;
    const active = () => token === attempt.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const connect = async () => {
        const { createAgentManager } = await import('@d-id/client-sdk');
        if (!active()) return;
        const agent = await createAgentManager(config.agentId, {
          auth: { type: 'key', clientKey: config.clientKey },
          callbacks: {
            onSrcObjectReady(stream) {
              if (!active() || !liveVideo.current) return;
              liveVideo.current.srcObject = stream;
              void liveVideo.current.play().catch(() => {
                if (active()) setNeedsPlay(true);
              });
            },
            onVideoStateChange(state) {
              if (active()) setSpeaking(state === 'START');
            },
            onNewMessage(messages, type) {
              if (!active()) return;
              setLines([
                hello,
                ...messages
                  .filter((m) => m.role === 'assistant' || m.role === 'user')
                  .map((m) => ({
                    id: m.id,
                    role: m.role as Line['role'],
                    content: m.content,
                  })),
              ]);
              if (type === 'answer') setBusy(false);
            },
            onConnectionStateChange(state) {
              if (
                active() &&
                ['fail', 'disconnected', 'closed'].includes(state)
              ) {
                void endSession();
                setError(
                  'The video connection ended. Start a new conversation to reconnect.',
                );
              }
            },
            onError() {
              if (active()) {
                void endSession();
                setError(
                  'The avatar service could not continue. Check the account credits and allowed domain, then try again.',
                );
              }
            },
          },
        });
        if (!active()) {
          await agent.disconnect().catch(() => {});
          return;
        }
        manager.current = agent;
        // SDK 2.x exposes these directly on agent, not agent.presenter.
        setIdleUrl(agent.agent.idle_video || '');
        setThumbnail(agent.agent.thumbnail || '');
        agent.registerClientTool('open_contact_form', async (args) => {
          if (!active()) throw new Error('Session ended.');
          const value = args as Record<string, unknown>;
          setInterest(
            typeof value.interest === 'string'
              ? value.interest.slice(0, 1000)
              : '',
          );
          setContactOpen(true);
          return JSON.stringify({
            status: 'form_opened',
            saved: false,
            message:
              'The visitor must review and submit the form. No enquiry has been saved yet.',
          });
        });
        await agent.connect();
        if (!active()) {
          await agent.disconnect().catch(() => {});
          return;
        }
        deadline.current = Date.now() + 180_000;
        setRemaining(180);
        setStatus('connected');
      };
      await Promise.race([
        connect(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('timeout')), 35_000);
        }),
      ]);
    } catch {
      if (active()) {
        await endSession();
        setError(
          'Could not connect. Check your D-ID agent, client key, allowed domain, and available credits.',
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async function send(text: string) {
    const input = text.trim();
    if (
      !input ||
      input.length > 1000 ||
      busy ||
      !config ||
      (config.live && status !== 'connected')
    )
      return;
    setQuestion('');
    setError('');
    if (!config.live) {
      const answer = previewAnswer(input, faq);
      setLines((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: 'user', content: input },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer.text,
          source: answer.source,
        },
      ]);
      if (answer.contact) {
        setInterest('');
        setContactOpen(true);
      }
      return;
    }
    setBusy(true);
    const token = attempt.current;
    let responseTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        manager.current!.chat(input),
        new Promise<never>((_, reject) => {
          responseTimeout = setTimeout(
            () => reject(new Error('timeout')),
            45_000,
          );
        }),
      ]);
    } catch {
      if (token === attempt.current) {
        await endSession();
        setError('The reply could not finish. Please reconnect and try again.');
      }
    } finally {
      clearTimeout(responseTimeout);
      if (token === attempt.current) setBusy(false);
    }
  }

  async function toggleMic() {
    const agent = manager.current;
    if (!agent || !config?.microphone || micBusy) return;
    setMicBusy(true);
    setError('');
    const token = attempt.current;
    try {
      if (micOn) {
        microphone.current?.getTracks().forEach((track) => track.stop());
        microphone.current = null;
        setMicOn(false);
        await agent.unpublishMicrophoneStream?.();
      } else {
        if (!agent.publishMicrophoneStream) throw new Error();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (token !== attempt.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        microphone.current = stream;
        await agent.publishMicrophoneStream(stream);
        if (token === attempt.current) setMicOn(true);
        else stream.getTracks().forEach((track) => track.stop());
      }
    } catch {
      microphone.current?.getTracks().forEach((track) => track.stop());
      microphone.current = null;
      setMicOn(false);
      setError(
        'Microphone unavailable. Check browser permission and use an Expressive avatar, or type your question.',
      );
    } finally {
      setMicBusy(false);
    }
  }

  const canChat = Boolean(config && (!config.live || status === 'connected'));
  const showStream =
    status === 'connected' && (config?.microphone || speaking || !idleUrl);
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="AI Concept Lab home">
          <span className="brand-icon">
            <FlaskConical size={23} />
          </span>
          <span>
            AI CONCEPT LAB
            <span className="brand-sub">Small builds. Real possibilities.</span>
          </span>
        </Link>
        <span className="edition">
          THE POC SERIES <span>001 / VIDEO RECEPTIONIST</span>
        </span>
        <Button
          variant="outline"
          className="header-button"
          onClick={() => {
            setInterest('');
            setContactOpen(true);
          }}
        >
          Let’s talk <ArrowUpRight />
        </Button>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">
              <span /> EXPERIMENT 001
            </p>
            <h1>
              A warmer way
              <br className="mobile-break" /> to say hello.
            </h1>
            <p>Meet Nova. Ask a question. Explore an idea.</p>
          </div>
          <div className="mode">
            <span className={config?.live ? 'dot live' : 'dot'} />
            {config?.live ? 'Live avatar mode' : 'Interactive preview'}
            <small>
              {config?.live
                ? 'Video powered by D-ID'
                : 'Sample FAQ · no account needed'}
            </small>
          </div>
        </div>
        <div className="workspace">
          <section className="avatar-panel" aria-label="Video receptionist">
            <div className="avatar-top">
              <span className="glass-label">
                <span className="dot live" />
                {status === 'connected'
                  ? 'CONNECTED'
                  : status === 'connecting'
                    ? 'CONNECTING'
                    : 'MEET YOUR RECEPTIONIST'}
              </span>
              <span className="ai-label">AI AVATAR</span>
            </div>
            <div className="avatar-stage">
              {thumbnail ? (
                <Image
                  className="portrait"
                  src={thumbnail}
                  width={1024}
                  height={1024}
                  unoptimized
                  alt="Your configured D-ID receptionist"
                />
              ) : (
                <div className="nova-mark" aria-hidden="true">
                  <span>N</span>
                  <div className="mark-caption">NOVA / AI CONCEPT LAB</div>
                </div>
              )}
              {idleUrl && (
                <video
                  className="avatar-video"
                  src={idleUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ opacity: showStream ? 0 : 1 }}
                  aria-label="Avatar idle video"
                />
              )}
              <video
                ref={liveVideo}
                className="avatar-video"
                autoPlay
                playsInline
                style={{ opacity: showStream ? 1 : 0 }}
                aria-label="Live AI receptionist video"
                aria-describedby="conversation-transcript"
              />
            </div>
            <div className="avatar-bottom">
              <div className="identity">
                <div>
                  <span className="mini-label">YOUR AI RECEPTIONIST</span>
                  <h2>
                    Nova<span>✳</span>
                  </h2>
                </div>
                <div
                  className={'wave ' + (speaking ? 'speaking' : '')}
                  aria-hidden="true"
                >
                  {[12, 24, 36, 20, 44, 28, 16].map((h, i) => (
                    <i
                      key={i}
                      style={{ height: h, animationDelay: i * 0.1 + 's' }}
                    />
                  ))}
                </div>
              </div>
              <p>
                {config?.live
                  ? status === 'connected'
                    ? 'I’m here. What would you like to know?'
                    : 'A face-to-face conversation, one click away.'
                  : 'Try the conversation below. Connect D-ID to bring Nova to life.'}
              </p>
              <div className="session-controls">
                {status === 'connected' ? (
                  <>
                    {config?.microphone && (
                      <Button
                        className="mic-button"
                        variant="secondary"
                        onClick={toggleMic}
                        disabled={micBusy}
                        aria-pressed={micOn}
                      >
                        {micOn ? <Mic /> : <MicOff />}
                        {micOn ? 'Mic on' : 'Enable mic'}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => void endSession()}
                    >
                      <PhoneOff />
                      End conversation
                    </Button>
                    <span className="timer">
                      {Math.floor(remaining / 60)}:
                      {String(remaining % 60).padStart(2, '0')}
                    </span>
                  </>
                ) : (
                  <Button
                    className="start-button"
                    disabled={!config || status === 'connecting'}
                    onClick={
                      config?.live
                        ? startSession
                        : () => void send(faq[1].question)
                    }
                  >
                    <Play size={16} />
                    {status === 'connecting'
                      ? 'Connecting…'
                      : config?.live
                        ? 'Start conversation'
                        : 'Try a sample question'}
                    <ArrowUpRight />
                  </Button>
                )}
                {status === 'connecting' && (
                  <Button variant="secondary" onClick={() => void endSession()}>
                    Cancel
                  </Button>
                )}
              </div>
              {needsPlay && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void liveVideo.current
                      ?.play()
                      .then(() => setNeedsPlay(false))
                      .catch(() =>
                        setError(
                          'Your browser blocked audio. Check site permissions.',
                        ),
                      );
                  }}
                >
                  <Volume2 />
                  Enable sound
                </Button>
              )}
              <p className="media-note">
                {config?.live
                  ? 'Camera stays off · Microphone is optional · 3-minute sessions'
                  : 'Preview uses exact FAQ answers. No live video or microphone.'}
              </p>
            </div>
          </section>
          <section className="conversation-panel" aria-label="Conversation">
            <div className="conversation-heading">
              <div>
                <AudioLines size={21} />
                <h2>The conversation</h2>
              </div>
              <span>{config?.live ? 'WITH NOVA' : 'PREVIEW'}</span>
            </div>
            <div
              id="conversation-transcript"
              className="messages"
              role="log"
              aria-label="Conversation transcript"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {lines.map((line) => (
                <div className={'message ' + line.role} key={line.id}>
                  <span className="speaker">
                    {line.role === 'user' ? 'YOU' : 'NOVA'}
                    {line.role === 'assistant' && <span>AI</span>}
                  </span>
                  <p>{line.content}</p>
                  {line.source && (
                    <button className="source" onClick={() => setFaqOpen(true)}>
                      <FileText size={12} />
                      Sample FAQ / {line.source}
                    </button>
                  )}
                </div>
              ))}
              {busy && <p className="thinking">Nova is finding an answer…</p>}
              <div ref={endOfMessages} />
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="composer-area">
              <div className="suggestions">
                {faq.slice(1, 4).map((f) => (
                  <button
                    key={f.id}
                    disabled={!canChat || busy}
                    onClick={() => void send(f.question)}
                  >
                    {f.question}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(question);
                }}
              >
                <input
                  aria-label="Your question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={1000}
                  disabled={!canChat || busy}
                  placeholder={
                    config?.live && status !== 'connected'
                      ? 'Start a conversation to ask Nova…'
                      : 'Ask Nova anything about the lab…'
                  }
                />
                <Button
                  type="submit"
                  aria-label="Send question"
                  disabled={!canChat || busy || !question.trim()}
                >
                  <ArrowUp size={19} />
                </Button>
              </form>
              <p className="transcript-note">
                {config?.live
                  ? 'Live messages are sent to D-ID. AI answers can be mistaken.'
                  : 'Preview questions stay in your browser.'}
              </p>
            </div>
          </section>
        </div>
        <div className="below-workspace">
          <div>
            <span className="number">01</span>
            <span>
              <strong>A little knowledge goes a long way.</strong>
              <br />
              Services, scope, pricing, and what comes next.
            </span>
            <button onClick={() => setFaqOpen(true)}>
              Read the sample FAQ <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="contact-link"
            onClick={() => {
              setInterest('');
              setContactOpen(true);
            }}
          >
            Have a project in mind?
            <span>
              Leave an enquiry <ArrowUpRight size={18} />
            </span>
          </button>
        </div>
      </main>
      <footer>
        <span>
          AI CONCEPT LAB <span className="footer-separator">/</span> FROM
          CONCEPT TO CONVERSATION
        </span>
        <span>POC #001 · Fictional business · Use test details</span>
      </footer>
      {contactOpen && (
        <LeadForm
          open={contactOpen}
          onOpenChange={setContactOpen}
          initialInterest={interest}
        />
      )}
      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogContent className="faq-dialog">
          <DialogTitle>Nova’s sample knowledge</DialogTitle>
          <DialogDescription>
            Fictional business facts for this POC. Live mode uses the copy
            uploaded to D-ID.
          </DialogDescription>
          <div className="faq-content">
            {faq.map((f) => (
              <article id={f.id} key={f.id}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadForm({
  open,
  onOpenChange,
  initialInterest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialInterest: string;
}) {
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [id] = useState(() => crypto.randomUUID());
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !consent) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: data.get('name'),
          email: data.get('email'),
          interest: data.get('interest'),
          website: data.get('website'),
          consent,
        }),
      });
      const result = (await response.json()) as {
        saved?: boolean;
        error?: string;
      };
      if (!response.ok || !result.saved)
        throw new Error(result.error || 'Could not save your enquiry.');
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent className="lead-dialog" showCloseButton={!saving}>
        <DialogTitle>
          {saved ? 'Enquiry saved.' : 'Let’s explore your idea.'}
        </DialogTitle>
        <DialogDescription>
          {saved
            ? 'Your test enquiry is stored in this app. This demo does not send email or schedule a meeting.'
            : 'A name, an email, and a little about your project. Use test details for this demonstration.'}
        </DialogDescription>
        {saved ? (
          <div className="saved-state">
            <span>
              <Check size={28} />
            </span>
            <p>You’ve completed the receptionist’s lead-capture flow.</p>
            <Button onClick={() => onOpenChange(false)}>Back to Nova</Button>
          </div>
        ) : (
          <form className="lead-form" onSubmit={submit}>
            <label htmlFor="lead-name">
              Your name
              <Input
                id="lead-name"
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                placeholder="Alex Morgan"
              />
            </label>
            <label htmlFor="lead-email">
              Email address
              <Input
                id="lead-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="alex@example.com"
              />
            </label>
            <label htmlFor="lead-interest">
              What would you like to build?
              <Textarea
                id="lead-interest"
                name="interest"
                defaultValue={initialInterest}
                required
                maxLength={1000}
                rows={3}
                placeholder="A receptionist for my business…"
              />
            </label>
            <div className="honeypot" aria-hidden="true">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="consent" htmlFor="lead-consent">
              <Checkbox
                id="lead-consent"
                checked={consent}
                onCheckedChange={setConsent}
              />
              <span>
                I agree to this app storing my name, email, and enquiry for this
                demo.
              </span>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={!consent || saving}>
              {saving ? 'Saving…' : 'Save enquiry'}
              <ArrowUpRight />
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
