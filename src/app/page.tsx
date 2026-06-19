"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SparklesIcon,
  UserIcon,
  FilterIcon,
  PaletteIcon,
  LinkIcon,
  MonitorIcon,
  CopyIcon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react";

type MessageType = "chat" | "follow" | "gift" | "member" | "like";

interface ConfigStore {
  username: string;
  filters: Record<MessageType, boolean>;
  bubbleColors: Record<MessageType, string>;
  textColor: string;
  maxMessages: number;
  duration: number;
  showUsername: boolean;
}

const MESSAGE_TYPES: MessageType[] = [
  "chat",
  "follow",
  "gift",
  "member",
  "like",
];
const TYPE_LABELS: Record<MessageType, string> = {
  chat: "Chat",
  follow: "Follow",
  gift: "Gift",
  member: "Live Join",
  like: "Likes",
};
const DEFAULT_COLORS: Record<MessageType, string> = {
  chat: "#b5ead7",
  follow: "#ffdac1",
  gift: "#ffb3c6",
  member: "#c7ceea",
  like: "#e2f0cb",
};

interface TestMessage {
  id: string;
  type: MessageType;
  nickname: string;
  content: string;
}

const TEST_MESSAGES: TestMessage[] = [
  {
    id: "1",
    type: "chat",
    nickname: "noobmaster69",
    content: "Love the stream today!",
  },
  {
    id: "2",
    type: "member",
    nickname: "new_viewer",
    content: "joined the stream!",
  },
  { id: "3", type: "gift", nickname: "gift_giver", content: "sent a gift!" },
  { id: "4", type: "follow", nickname: "follower1", content: "followed!" },
  { id: "5", type: "like", nickname: "viewer22", content: "liked! (24)" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.8,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

const bubbleVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
  exit: {
    x: -20,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

function ToggleSwitch({
  enabled,
  onToggle,
  accentColor,
}: {
  enabled: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`toggle-switch ${enabled ? "toggle-switch-on" : "toggle-switch-off"}`}
      style={enabled ? { background: accentColor } : undefined}
    >
      <motion.div
        className="toggle-switch-thumb"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function ColorSwatch({
  color,
  onChange,
  ariaLabel,
}: {
  color: string;
  onChange: (color: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="color-swatch-wrapper">
      <div className="color-swatch" style={{ background: color }} />
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="color-input-hidden"
        aria-label={ariaLabel}
      />
    </div>
  );
}

function PreviewPanel({ config }: { config: ConfigStore }) {
  const visibleMessages = TEST_MESSAGES.slice(0, config.maxMessages);

  return (
    <motion.div
      className="preview-panel"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="preview-container" style={{ aspectRatio: 16 / 10 }}>
        <div className="preview-label">
          <MonitorIcon size={12} />
          <span>OBS Preview</span>
        </div>
        <div className="preview-messages">
          <AnimatePresence mode="popLayout">
            {visibleMessages.map((msg) => {
              const isVisible = config.filters[msg.type];
              return (
                <motion.div
                  key={msg.id}
                  variants={bubbleVariants}
                  initial="hidden"
                  animate={isVisible ? "visible" : "exit"}
                  exit="exit"
                  className={`preview-bubble ${!isVisible ? "hidden" : ""}`}
                  style={{
                    backgroundColor: config.bubbleColors[msg.type],
                    color: config.textColor,
                  }}
                >
                  {msg.type === "chat" && config.showUsername ? (
                    <>
                      <span className="nickname">{msg.nickname}</span>
                      <span>: {msg.content}</span>
                    </>
                  ) : msg.type === "chat" ? (
                    <span>{msg.content}</span>
                  ) : (
                    <span>
                      {config.showUsername && (
                        <span className="nickname">{msg.nickname} </span>
                      )}
                      {msg.content}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function ConfigPanel({
  config,
  onChange,
  overlayUrl,
}: {
  config: ConfigStore;
  onChange: (update: Partial<ConfigStore>) => void;
  overlayUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = overlayUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [overlayUrl]);

  const toggleFilter = useCallback(
    (type: MessageType) => {
      onChange({
        filters: { ...config.filters, [type]: !config.filters[type] },
      });
    },
    [config.filters, onChange],
  );

  const setBubbleColor = useCallback(
    (type: MessageType, color: string) => {
      onChange({
        bubbleColors: { ...config.bubbleColors, [type]: color },
      });
    },
    [config.bubbleColors, onChange],
  );

  return (
    <motion.div
      className="config-panel"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="config-card" variants={cardVariants}>
        <h2 className="config-card-title">
          <UserIcon size={20} />
          Tiktok Username
        </h2>
        <input
          type="text"
          className="studio-input"
          placeholder="@username"
          value={config.username}
          onChange={(e) =>
            onChange({
              username: e.target.value.replace(/^@/, ""),
            })
          }
        />
        {!config.username && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
              fontSize: "13px",
              color: "#ffb3c6",
            }}
          >
            <AlertCircleIcon size={14} />
            <span>Enter a username to generate the overlay URL</span>
          </motion.div>
        )}
      </motion.div>

      <motion.div className="config-card" variants={cardVariants}>
        <h2 className="config-card-title">
          <FilterIcon size={20} />
          Show Message Type
        </h2>
        {MESSAGE_TYPES.map((type) => (
          <div key={type} className="toggle-row">
            <div className="toggle-row-left">
              <div
                className="toggle-color-dot"
                style={{ backgroundColor: config.bubbleColors[type] }}
              />
              <span className="toggle-label">{TYPE_LABELS[type]}</span>
            </div>
            <ToggleSwitch
              enabled={config.filters[type]}
              onToggle={() => toggleFilter(type)}
              accentColor={config.bubbleColors[type]}
            />
          </div>
        ))}

        <div className="show-username-row">
          <div className="toggle-row-left">
            <span className="toggle-label">Show Username</span>
          </div>
          <ToggleSwitch
            enabled={config.showUsername}
            onToggle={() => onChange({ showUsername: !config.showUsername })}
            accentColor="#c7ceea"
          />
        </div>
      </motion.div>

      <motion.div className="config-card" variants={cardVariants}>
        <h2 className="config-card-title">
          <PaletteIcon size={20} />
          Appearance
        </h2>

        {MESSAGE_TYPES.map((type) => (
          <div key={type} className="color-row">
            <span className="color-row-left">{TYPE_LABELS[type]}</span>
            <ColorSwatch
              color={config.bubbleColors[type]}
              onChange={(color) => setBubbleColor(type, color)}
              ariaLabel={`Change ${TYPE_LABELS[type]} bubble color`}
            />
          </div>
        ))}

        <div className="slider-container">
          <div className="slider-header">
            <span className="slider-label">Message Limit</span>
            <span className="slider-value">{config.maxMessages}</span>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            value={config.maxMessages}
            onChange={(e) => onChange({ maxMessages: Number(e.target.value) })}
            className="studio-slider"
          />
        </div>

        <div className="slider-container">
          <div className="slider-header">
            <span className="slider-label">Message Duration</span>
            <span className="slider-value">{config.duration}</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            value={config.duration}
            onChange={(e) => onChange({ duration: Number(e.target.value) })}
            className="studio-slider"
          />
        </div>
      </motion.div>

      <motion.div className="config-card" variants={cardVariants}>
        <h2 className="config-card-title">
          <LinkIcon size={20} />
          Your Overlay URL
        </h2>
        <p style={{ fontSize: "13px", color: "#9b8a9d", margin: "0 0 14px" }}>
          Copy this URL into your OBS Browser Source
        </p>

        <motion.div
          className="url-display"
          key={overlayUrl}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {overlayUrl ? (
            <span>
              <span className="url-display-highlight">{overlayUrl}</span>
            </span>
          ) : (
            <span>Enter a username to generate your overlay URL...</span>
          )}
        </motion.div>

        {overlayUrl && (
          <motion.button
            className={`copy-button ${copied ? "copy-button-success" : ""}`}
            onClick={handleCopy}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? "Copied" : "Copy URL"}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function StudioPage() {
  const [config, setConfig] = useState<ConfigStore>({
    username: "",
    filters: {
      chat: true,
      follow: true,
      gift: true,
      member: true,
      like: true,
    },
    bubbleColors: { ...DEFAULT_COLORS },
    textColor: "#5a4a5c",
    maxMessages: 10,
    duration: 10,
    showUsername: true,
  });

  const handleConfigChange = useCallback((update: Partial<ConfigStore>) => {
    setConfig((prev) => ({ ...prev, ...update }));
  }, []);

  const overlayUrl = useMemo(() => {
    if (!config.username) return "";

    const params = new URLSearchParams();
    params.set("username", config.username);

    if (config.duration !== 10) params.set("duration", String(config.duration));
    if (config.maxMessages !== 10)
      params.set("maxMessages", String(config.maxMessages));
    if (!config.showUsername) params.set("showUsername", "0");

    const activeTypes = MESSAGE_TYPES.filter((t) => config.filters[t]);
    if (activeTypes.length < 5) {
      params.set("types", activeTypes.join(","));
    }

    MESSAGE_TYPES.forEach((type) => {
      if (config.bubbleColors[type] !== DEFAULT_COLORS[type]) {
        params.set(`${type}Color`, config.bubbleColors[type].replace("#", ""));
      }
    });

    if (config.textColor !== "#5a4a5c") {
      params.set("textColor", config.textColor.replace("#", ""));
    }

    return `${typeof window !== "undefined" ? window.location.origin : ""}/overlay?${params.toString()}`;
  }, [config]);

  return (
    <div className="studio-page">
      <motion.header
        className="studio-header"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
      >
        <div className="studio-header-bg" />
        <h1>
          <SparklesIcon size={28} color="#ffb3c6" />
          Overlay Studio
        </h1>
        <p>Cuztomize your TikTok live chat overlay</p>
      </motion.header>

      <main className="studio-grid">
        <PreviewPanel config={config} />
        <ConfigPanel
          config={config}
          onChange={handleConfigChange}
          overlayUrl={overlayUrl}
        />
      </main>
    </div>
  );
}
