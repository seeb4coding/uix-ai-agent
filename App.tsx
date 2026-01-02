import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  NodeProps,
  NodeToolbar,
  Position,
  BackgroundVariant,
} from "reactflow";
import JSZip from "jszip";
import { marked } from "marked";
import {
  generateProductArtifacts,
  refinePrompt,
  modifyScreen,
  generateNewScreen,
  ReferenceAsset,
  ChatMessage,
} from "./services/geminiService";

// --- Types ---
interface Project {
  id: string;
  name: string;
  timestamp: number;
  data: any;
  themePreference: "light" | "dark";
  chatHistory: ChatMessage[];
}

type Breakpoint = "mobile" | "tablet" | "desktop";
type AIProvider = "gemini" | "openrouter";

interface Notification {
  message: string;
  type: "success" | "error";
}

const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
};

const BREAKPOINT_HEIGHTS: Record<Breakpoint, number> = {
  mobile: 812,
  tablet: 1024,
  desktop: 800,
};

const MODEL_OPTIONS = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "x-ai/grok-2-vision", label: "Grok 2 Vision" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "glm-4-5-air", label: "GLM 4.5 Air (Free)" },
  { id: "custom", label: "Custom..." },
];

const getFullHtml = (markup: string, design: any) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=${
    design.font.replace(/\s+/g, "+") || "Inter"
  }:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${design.colors.primary};
      --secondary: ${design.colors.secondary};
      --accent: ${design.colors.accent};
      --background: ${design.colors.background};
      --foreground: ${design.colors.text};
      --card: ${design.colors.surface};
      --muted: ${design.colors.muted || "#64748b"};
      --muted-foreground: ${design.colors.muted || "#94a3b8"};
      --border: ${design.colors.border || design.colors.surface};
      --radius: ${design.radius || "1rem"};
    }
    body { 
      background: var(--background); 
      color: var(--foreground); 
      font-family: '${design.font}', sans-serif; 
      margin: 0; 
      padding: 0; 
      min-height: 100vh; 
      width: 100%;
    }
    #root { width: 100%; min-height: 100vh; }
    ::-webkit-scrollbar { display: none; }
    .scrollbar-none::-webkit-scrollbar { display: none; }
    iconify-icon { vertical-align: middle; }
  </style>
</head>
<body class="scrollbar-none overflow-x-hidden">
  <div id="root">${markup || ""}</div>
</body>
</html>`.trim();
};

const MarkdownContent = ({ content }: { content: string }) => {
  const html = marked.parse(content);
  return (
    <div
      className="markdown-content text-[13px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const ScreenNode = ({ data, selected }: NodeProps) => {
  const width = BREAKPOINT_WIDTHS[data.currentBreakpoint as Breakpoint];
  const height = BREAKPOINT_HEIGHTS[data.currentBreakpoint as Breakpoint];

  const handleExportSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const htmlContent = getFullHtml(data.markup, data.designSystem);
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.name.toLowerCase().replace(/\s+/g, "_")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`flex flex-col gap-6 transition-all duration-300 ${
        selected ? "scale-[1.02] z-[1000]" : "opacity-100 z-10"
      } ${data.justCreated ? "ring-8 ring-indigo-500/30 animate-pulse" : ""}
  ${selected ? "scale-[1.02]" : ""}`}
    >
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={15}
        className="z-[2000]"
      >
        <div className="flex flex-col gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-[340px] animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-100">
                Contextual Refinement
              </h3>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDeselect();
              }}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 items-stretch">
            <textarea
              value={data.modifyInput}
              onChange={(e) => data.onModifyInputChange(e.target.value)}
              placeholder="e.g. 'Add a line chart for heart rate'"
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all h-16 resize-none custom-scrollbar"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onHandleModify();
              }}
              disabled={
                data.isModifying || !data.modifyInput.trim() || data.isAiBusy
              }
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 rounded-xl transition-all flex items-center justify-center shrink-0"
            >
              <span className="text-[10px] font-black uppercase">
                {data.isModifying ? "..." : "Apply"}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
            <div className="flex gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onToggleLive(data.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                  data.isLive
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    data.isLive ? "bg-green-400 animate-pulse" : "bg-slate-300"
                  }`}
                />
                {data.isLive ? "Live Mode" : "Static Mode"}
              </button>
              <button
                onClick={handleExportSingle}
                className="px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-1.5"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete(data.id);
              }}
              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
              title="Delete Screen"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </NodeToolbar>

      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 rounded-3xl cursor-grab active:cursor-grabbing custom-drag-handle group/header border border-transparent hover:border-indigo-500/20 transition-all shadow-sm">
        <div className="flex flex-col gap-1 pointer-events-none">
          <span className="text-[14px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 group-hover/header:text-indigo-500 transition-colors leading-tight">
            {data.name}
          </span>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wide uppercase opacity-75 truncate max-w-[280px]">
            {data.purpose}
          </span>
        </div>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            selected
              ? "bg-indigo-600 text-white"
              : "bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-0 group-hover/header:opacity-100"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </div>
      </div>

      <div
        style={{ width: `${width}px`, height: `${height}px` }}
        className={`relative bg-slate-50 dark:bg-slate-900 rounded-[40px] shadow-2xl border-4 transition-all duration-700 ease-in-out overflow-hidden ${
          selected
            ? "border-indigo-500 ring-[16px] ring-indigo-500/10"
            : "border-slate-100 dark:border-slate-800"
        }`}
      >
        <iframe
          srcDoc={getFullHtml(data.markup, data.designSystem)}
          className={`w-full h-full border-none pointer-events-none ${
            data.isLive ? "pointer-events-auto" : ""
          }`}
          title={data.name}
          sandbox="allow-scripts allow-same-origin"
        />
        {!data.isLive && (
          <div className="absolute inset-0 bg-transparent z-20 cursor-default" />
        )}
      </div>
    </div>
  );
};

const nodeTypes = { screen: ScreenNode };

function Canvas() {
  const {
    fitView,
    getNodes,
    setNodes: rfSetNodes,
    zoomIn,
    zoomOut,
  } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const aiLockRef = useRef(false);

  // Projects & History
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState("");
  const [architecture, setArchitecture] = useState<"web" | "app">("web");
  const [appTheme, setAppTheme] = useState<"light" | "dark">("dark");
  const [productTheme, setProductTheme] = useState<"light" | "dark">("light");

  const [currentBreakpoint, setCurrentBreakpoint] =
    useState<Breakpoint>("desktop");
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [activeLiveScreens, setActiveLiveScreens] = useState<Set<string>>(
    new Set()
  );
  const [modifyInput, setModifyInput] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const [isAddingScreen, setIsAddingScreen] = useState(false);
  const [newScreenPrompt, setNewScreenPrompt] = useState("");
  const [isGeneratingNewScreen, setIsGeneratingNewScreen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // Settings state (Persisted)
  const [selectedProvider, setSelectedProvider] =
    useState<AIProvider>("gemini");
  const [selectedModelId, setSelectedModelId] = useState(
    "gemini-3-flash-preview"
  );
  const [customModelId, setCustomModelId] = useState("custom-model-id");
  const [customApiKey, setCustomApiKey] = useState("");

  const didInitialLayout = useRef(false);
  const isAiBusy = isGenerating || isGeneratingNewScreen || isModifying;

  // --- Persistence & Initialization ---
  useEffect(() => {
    const savedProjects = localStorage.getItem("stitch_v3_projects");
    const savedTheme = localStorage.getItem("stitch_app_theme");
    const savedProvider = localStorage.getItem("uix_provider");
    const savedModelId = localStorage.getItem("uix_model_id");
    const savedApiKey = localStorage.getItem("uix_api_key");

    if (savedProjects) setProjects(JSON.parse(savedProjects));
    if (savedTheme) setAppTheme(savedTheme as "light" | "dark");
    if (savedProvider) setSelectedProvider(savedProvider as AIProvider);
    if (savedModelId) setSelectedModelId(savedModelId);
    if (savedApiKey) setCustomApiKey(savedApiKey);
  }, []);

  const saveSettings = () => {
    localStorage.setItem("uix_provider", selectedProvider);
    localStorage.setItem("uix_model_id", selectedModelId);
    localStorage.setItem("uix_api_key", customApiKey);
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem("stitch_v3_projects", JSON.stringify(projects));
    }
  }, [projects]);

  useEffect(() => {
    localStorage.setItem("stitch_app_theme", appTheme);
  }, [appTheme]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showSuccess = (message: string) => {
    setNotification({ message, type: "success" });
    setTimeout(() => setNotification(null), 4000);
  };

  const showError = (message: string) => {
    setNotification({ message, type: "error" });
    setTimeout(() => setNotification(null), 5000);
  };

  // --- History Logic ---
  const pushToHistory = useCallback((current: Project | null) => {
    if (current) {
      setPast((prev) =>
        [...prev, JSON.parse(JSON.stringify(current))].slice(-30)
      );
      setFuture([]);
    }
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0 || !currentProject) return;
    const previous = past[past.length - 1];
    setFuture((prev) => [JSON.parse(JSON.stringify(currentProject)), ...prev]);
    setPast(past.slice(0, -1));
    setCurrentProject(previous);
    setMessages(previous.chatHistory || []);
  }, [past, currentProject]);

  const redo = useCallback(() => {
    if (future.length === 0 || !currentProject) return;
    const next = future[0];
    setPast((prev) => [...prev, JSON.parse(JSON.stringify(currentProject))]);
    setFuture(future.slice(1));
    setCurrentProject(next);
    setMessages(next.chatHistory || []);
  }, [future, currentProject]);

  const handleSaveSnapshot = useCallback(() => {
    if (!currentProject) return;
    setProjects((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === currentProject.id);
      if (existingIndex >= 0) {
        const updatedProjects = [...prev];
        updatedProjects[existingIndex] = {
          ...currentProject,
          timestamp: Date.now(),
        };
        return updatedProjects;
      } else {
        return [{ ...currentProject, timestamp: Date.now() }, ...prev];
      }
    });
    showSuccess("Workspace saved successfully");
  }, [currentProject]);

  // --- Layout & Alignment ---
  const triggerAutoLayout = useCallback(() => {
    if (!currentProject) return;
    const nodeWidth = BREAKPOINT_WIDTHS[currentBreakpoint];
    const nodeHeight = BREAKPOINT_HEIGHTS[currentBreakpoint];
    const horizontalSpacing = nodeWidth + 150;
    const verticalSpacing = nodeHeight + 150;
    const columns = currentBreakpoint === "desktop" ? 2 : 3;
    const updatedScreens = currentProject.data.screens.map(
      (s: any, idx: number) => {
        const x = (idx % columns) * horizontalSpacing;
        const y = Math.floor(idx / columns) * verticalSpacing;
        return { ...s, position: { x, y } };
      }
    );
    const updatedProject = {
      ...currentProject,
      data: { ...currentProject.data, screens: updatedScreens },
    };
    setCurrentProject(updatedProject);
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 800 }));
  }, [currentProject, currentBreakpoint, fitView]);

  useEffect(() => {
    if (currentProject) triggerAutoLayout();
  }, [currentBreakpoint]);

  useEffect(() => {
    if (!didInitialLayout.current && nodes.length > 0 && currentProject) {
      didInitialLayout.current = true;
      requestAnimationFrame(() => triggerAutoLayout());
    }
  }, [nodes.length, currentProject, triggerAutoLayout]);

  useEffect(() => {
    if (!currentProject) return;
    const createdScreen = currentProject.data?.screens?.find(
      (s: any) => s.justCreated
    );
    if (!createdScreen) return;
    requestAnimationFrame(() =>
      fitView({
        nodes: [{ id: createdScreen.id }],
        padding: 0.4,
        duration: 700,
      })
    );
    setTimeout(() => {
      setCurrentProject((curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          data: {
            ...curr.data,
            screens: curr.data.screens.map((s: any) =>
              s.id === createdScreen.id ? { ...s, justCreated: false } : s
            ),
          },
        };
      });
    }, 900);
  }, [currentProject, fitView]);

  const toggleLock = useCallback((id: string) => {
    setCurrentProject((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        data: {
          ...curr.data,
          screens: curr.data.screens.map((s: any) =>
            s.id === id ? { ...s, locked: !s.locked } : s
          ),
        },
      };
    });
  }, []);

  const acquireAiLock = () => {
    if (aiLockRef.current) return false;
    aiLockRef.current = true;
    return true;
  };
  const releaseAiLock = () => {
    aiLockRef.current = false;
  };

  // --- Node Events ---
  const onNodeDragStop = useCallback((_: any, node: any) => {
    setCurrentProject((curr) => {
      if (!curr) return null;
      const updatedScreens = curr.data.screens.map((s: any) =>
        s.id === node.id ? { ...s, position: node.position } : s
      );
      const updated = {
        ...curr,
        data: { ...curr.data, screens: updatedScreens },
      };
      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      return updated;
    });
  }, []);

  const deselectNodes = useCallback(
    () => rfSetNodes((nds) => nds.map((n) => ({ ...n, selected: false }))),
    [rfSetNodes]
  );
  const toggleLive = useCallback(
    (id: string) =>
      setActiveLiveScreens((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  const deleteScreen = useCallback(
    (id: string) => {
      setCurrentProject((curr) => {
        if (!curr) return null;
        pushToHistory(curr);
        const updatedScreens = curr.data.screens.filter(
          (s: any) => s.id !== id
        );
        const updated = {
          ...curr,
          data: { ...curr.data, screens: updatedScreens },
        };
        setProjects((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        return updated;
      });
    },
    [pushToHistory]
  );

  // --- AI UIX ---
  const handleGenerate = async () => {
    if (!input.trim() || isGenerating) return;
    if (!acquireAiLock()) return;
    setIsGenerating(true);
    const newUserMsg: ChatMessage = { role: "user", content: input };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);

    try {
      const existingScreens = currentProject?.data?.screens || [];
      const modelToUse =
        selectedModelId === "custom" ? customModelId : selectedModelId;
      const result = await generateProductArtifacts(input, productTheme, {
        architecture,
        referenceAssets,
        chatHistory: updatedMessages,
        existingScreens: existingScreens.map((s: any) => ({
          id: s.id,
          name: s.name,
          purpose: s.purpose,
          markup: s.markup,
        })),
        model: modelToUse,
        apiKey: customApiKey || undefined,
        provider: selectedProvider,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content:
          result.assistantMessage ||
          "Architecture synthesized. Workspace updated.",
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      if (currentProject) {
        pushToHistory(currentProject);
        const updatedProject: Project = {
          ...currentProject,
          data: result,
          themePreference: productTheme,
          chatHistory: finalMessages,
          timestamp: Date.now(),
        };
        setCurrentProject(updatedProject);
        setProjects((prev) =>
          prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
        );
      } else {
        const newProject: Project = {
          id: Math.random().toString(36).substring(7),
          name: result.overview.name || "New Product",
          timestamp: Date.now(),
          data: result,
          themePreference: productTheme,
          chatHistory: finalMessages,
        };
        setProjects((prev) => [newProject, ...prev]);
        setCurrentProject(newProject);
      }

      setInput("");
      didInitialLayout.current = false;
      showSuccess("Architecture synthesized successfully");
    } catch (err: any) {
      console.error(err);
      showError(
        err.message || "UIX failed. Please check your API key or connection."
      );
    } finally {
      setIsGenerating(false);
      releaseAiLock();
    }
  };

  const handleModify = useCallback(async () => {
    const selectedId = getNodes().find((n) => n.selected)?.id;
    if (!selectedId || !modifyInput.trim() || !currentProject) return;
    if (!acquireAiLock()) return;
    setIsModifying(true);

    const newUserMsg: ChatMessage = {
      role: "user",
      content: `Refine screen "${selectedId}": ${modifyInput}`,
    };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);

    try {
      const screen = currentProject.data.screens.find(
        (s: any) => s.id === selectedId
      );
      const modelToUse =
        selectedModelId === "custom" ? customModelId : selectedModelId;
      const result = await modifyScreen(
        screen.name,
        screen.markup,
        modifyInput,
        currentProject.data.designSystem,
        updatedMessages,
        modelToUse,
        customApiKey || undefined,
        selectedProvider
      );

      pushToHistory(currentProject);
      const updatedScreens = currentProject.data.screens.map((s: any) =>
        s.id === selectedId
          ? { ...s, markup: result.markup, name: result.name }
          : s
      );
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.summary || "Refined the screen based on your feedback.",
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      const updatedProject = {
        ...currentProject,
        data: { ...currentProject.data, screens: updatedScreens },
        chatHistory: finalMessages,
      };
      setCurrentProject(updatedProject);
      setModifyInput("");
      showSuccess("Screen refined successfully");
    } catch (err: any) {
      showError(err.message || "Refinement failed.");
    } finally {
      setIsModifying(false);
      releaseAiLock();
    }
  }, [
    getNodes,
    modifyInput,
    currentProject,
    pushToHistory,
    messages,
    selectedModelId,
    customModelId,
    customApiKey,
    selectedProvider,
  ]);

  const handleGenerateNewScreen = async () => {
    if (!newScreenPrompt.trim() || isGeneratingNewScreen || !currentProject)
      return;
    if (!acquireAiLock()) return;
    setIsGeneratingNewScreen(true);

    const newUserMsg: ChatMessage = {
      role: "user",
      content: `Add screen: ${newScreenPrompt}`,
    };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);

    try {
      const modelToUse =
        selectedModelId === "custom" ? customModelId : selectedModelId;
      const result = await generateNewScreen(
        newScreenPrompt,
        currentProject.data.designSystem,
        architecture,
        {
          overview: currentProject.data.overview,
          existingScreens: currentProject.data.screens,
          chatHistory: updatedMessages,
        },
        modelToUse,
        customApiKey || undefined,
        selectedProvider
      );

      const newScreen = {
        id: Math.random().toString(36).substring(7),
        name: result.name,
        purpose: newScreenPrompt,
        markup: result.markup,
        position: { x: 0, y: 0 },
        justCreated: true,
      };

      pushToHistory(currentProject);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.summary || "Added the new screen.",
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      const updatedProject = {
        ...currentProject,
        data: {
          ...currentProject.data,
          screens: [...currentProject.data.screens, newScreen],
        },
        chatHistory: finalMessages,
      };
      setCurrentProject(updatedProject);
      setNewScreenPrompt("");
      setIsAddingScreen(false);
      didInitialLayout.current = false;
      fitView({ nodes: [{ id: newScreen.id }], padding: 0.4, duration: 700 });
      showSuccess("New screen synthesized");
    } catch (err: any) {
      showError(err.message || "Generation failed.");
    } finally {
      setIsGeneratingNewScreen(false);
      releaseAiLock();
    }
  };

  // --- Node Syncing ---
  useEffect(() => {
    if (currentProject?.data?.screens) {
      const newNodes = currentProject.data.screens.map((screen: any) => {
        const selectedNodeIds = new Set(
          getNodes()
            .filter((n) => n.selected)
            .map((n) => n.id)
        );
        const isSelected = selectedNodeIds.has(screen.id);
        return {
          id: screen.id,
          type: "screen",
          position: screen.position || { x: 0, y: 0 },
          data: {
            ...screen,
            designSystem: currentProject.data.designSystem,
            currentBreakpoint,
            isLive: activeLiveScreens.has(screen.id),
            modifyInput: isSelected ? modifyInput : "",
            isModifying,
            onModifyInputChange: setModifyInput,
            onHandleModify: handleHandleModify,
            onDeselect: deselectNodes,
            onToggleLive: toggleLive,
            onDelete: deleteScreen,
            onToggleLock: toggleLock,
            isAiBusy,
          },
          selected: isSelected,
          dragHandle: screen.locked ? undefined : ".custom-drag-handle",
          draggable: !screen.locked,
        };
      });
      rfSetNodes(newNodes);
    } else {
      rfSetNodes([]);
    }
  }, [
    currentProject,
    currentBreakpoint,
    activeLiveScreens,
    modifyInput,
    isModifying,
    deselectNodes,
    toggleLive,
    deleteScreen,
    handleModify,
    rfSetNodes,
  ]);

  const handleHandleModify = useCallback(() => handleModify(), [handleModify]);

  const handleFileReferenceChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files: any = Array.from(e.target.files || []);
    const newAssets: ReferenceAsset[] = [];
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const data = await new Promise<string>((r) => {
          const reader = new FileReader();
          reader.onloadend = () => r(reader.result as string);
          reader.readAsDataURL(file);
        });
        newAssets.push({ type: "image", data, name: file.name });
      }
    }
    setReferenceAssets((prev) => [...prev, ...newAssets].slice(-10));
    e.target.value = "";
  };

  const removeReference = (index: number) =>
    setReferenceAssets((prev) => prev.filter((_, i) => i !== index));

  const handleImportHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedProjects = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedProjects)) {
          setProjects((prev) => {
            const idSet = new Set(prev.map((p) => p.id));
            const merged = [...prev];
            importedProjects.forEach((p: any) => {
              if (!idSet.has(p.id)) merged.push(p);
            });
            return merged;
          });
          showSuccess("History imported successfully");
        }
      } catch (e) {
        showError("Failed to parse history bundle.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExportHistory = () => {
    const blob = new Blob([JSON.stringify(projects, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uix_agent_history_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportZip = async () => {
    if (!currentProject) return;
    const zip = new JSZip();
    currentProject.data.screens.forEach((s: any) =>
      zip.file(
        `${s.name.replace(/\s+/g, "_")}.html`,
        getFullHtml(s.markup, currentProject.data.designSystem)
      )
    );
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "project_screens.zip";
    link.click();
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`h-screen flex overflow-hidden relative ${
        appTheme === "dark"
          ? "dark bg-slate-900 text-slate-50"
          : "bg-white text-slate-900"
      }`}
    >
      <style>{`
        .modal-backdrop { backdrop-filter: blur(8px); background: rgba(0,0,0,0.6); }
        .chat-scroll::-webkit-scrollbar { width: 0; }
        .settings-input { background: #111114; border: 1px solid #1e1e24; border-radius: 8px; padding: 10px 12px; color: white; width: 100%; outline: none; font-size: 13px; }
        .settings-input:focus { border-color: #6366f1; }
        .settings-select { background: #111114; border: 1px solid #1e1e24; border-radius: 8px; padding: 10px 12px; color: white; width: 100%; outline: none; font-size: 13px; appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 12px center; background-size: 14px; }
        .main-logo { height: 50px; }
        @keyframes shake {
          0%, 100% { transform: translateX(-50%); }
          25% { transform: translateX(-52%); }
          75% { transform: translateX(-48%); }
        }
        .toast-error { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>

      {notification && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-[3000] px-6 py-4 rounded-3xl shadow-2xl font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-top-6 flex items-center gap-3 border ${
            notification.type === "error"
              ? "bg-rose-600 text-white border-rose-400 toast-error"
              : "bg-emerald-600 text-white border-emerald-400"
          }`}
        >
          {notification.type === "error" ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          {notification.message}
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 modal-backdrop animate-in fade-in">
          <div className="bg-[#18181b] w-full max-w-[420px] rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95">
            <header className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Model Settings</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </header>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  AI Provider
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedProvider("gemini")}
                    className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                      selectedProvider === "gemini"
                        ? "bg-[#3f3f46] border-slate-600 text-white shadow-lg"
                        : "bg-[#1e1e24] border-transparent text-slate-400"
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    onClick={() => setSelectedProvider("openrouter")}
                    className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                      selectedProvider === "openrouter"
                        ? "bg-[#4f46e5] border-transparent text-white shadow-xl"
                        : "bg-[#1e1e24] border-transparent text-slate-400"
                    }`}
                  >
                    OpenRouter
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  API Key
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="settings-input"
                />
                <p className="text-[10px] text-slate-600">
                  Key is stored locally in your browser. Leave blank for
                  internal Gemini.
                </p>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Model
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="settings-select"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={saveSettings}
                className="w-full py-3.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-2xl text-sm font-bold shadow-xl transition-all active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-[440px] border-r border-slate-100 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 z-50 shrink-0 shadow-xl overflow-hidden">
        <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 items-center justify-center shadow-lg">
                <img
                  src="https://seeb4coding.in/assets/images/UIX_logo.png"
                  alt="logo"
                />
              </div>
              <h1 className="text-xl font-black uppercase text-indigo-600">
                UIX Agent
              </h1>
            </div>
            <div className="flex items-center">
              <a
                href="https://seeb4coding.in/#ai-svg-ora-studio"
                className="text-indigo-600 dark:text-white hover:text-indigo-400 transition-colors"
                style={{ paddingLeft: "20px", fontSize: "18px" }}
              >
                <i className="fa-sharp fa-solid fa-arrow-left"></i>
              </a>
              <a
                href="https://seeb4coding.in/"
                className="hidden sm:block"
                style={{ paddingLeft: "40px" }}
              >
                <img
                  className="main-logo"
                  alt="seeb4coding"
                  src="https://seeb4coding.in/assets/images/seeb4coding-logo.png"
                  style={{
                    height: "50px",
                    filter:
                      appTheme === "dark" ? "brightness(0) invert(1)" : "none",
                  }}
                />
              </a>
            </div>
          </div>
          <div className="flex gap-1.5 self-end">
            <button
              onClick={() => {
                setCurrentProject(null);
                rfSetNodes([]);
                setMessages([]);
              }}
              className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
              title="New Workspace"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
            <button
              onClick={() =>
                setAppTheme((prev) => (prev === "light" ? "dark" : "light"))
              }
              className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
            >
              {appTheme === "light" ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.757 7.757l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
              title="Workspace History"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
              title="Model Settings"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <div className="w-[1px] h-6 bg-slate-100 dark:bg-slate-800 mx-1 self-center" />
            <label
              className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-all cursor-pointer"
              title="Import History Bundle"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <input
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleImportHistory}
              />
            </label>
            <button
              onClick={handleExportHistory}
              className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
              title="Export History Bundle"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 chat-scroll">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-10 gap-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Your intelligent UI & UX design assistant. Describe a product
                  or add/update screens while keeping global navigation in sync.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-lg"
                      : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm"
                  }`}
                >
                  <MarkdownContent content={msg.content} />
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 mt-2 px-2 tracking-widest">
                  {msg.role === "user" ? "You" : "UIX Agent"}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Architecture
                </h2>
                <span className="text-[8px] text-indigo-500 font-bold uppercase">
                  {selectedModelId === "custom"
                    ? customModelId
                    : selectedModelId}{" "}
                  Active
                </span>
              </div>
              <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setArchitecture("web")}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    architecture === "web"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400"
                  }`}
                >
                  Web
                </button>
                <button
                  onClick={() => setArchitecture("app")}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    architecture === "app"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400"
                  }`}
                >
                  App
                </button>
              </div>
              <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setProductTheme("light")}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    productTheme === "light"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400"
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setProductTheme("dark")}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    productTheme === "dark"
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <label
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all cursor-pointer border border-slate-100 dark:border-slate-700 active:scale-95 shadow-sm h-[45px]"
                  title="Add Assets"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.html"
                    multiple
                    onChange={handleFileReferenceChange}
                  />
                </label>
                <div className="flex-1 relative group">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder="Describe your vision..."
                    className="w-full min-h-[56px] max-h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 text-sm outline-none focus:border-indigo-500 transition-all resize-none shadow-inner text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !input.trim() || isAiBusy}
                    className={`absolute right-2 bottom-2 p-2.5 rounded-2xl transition-all shadow-lg ${
                      isGenerating || !input.trim()
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                    }`}
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-900">
        <nav className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex items-center justify-between px-8 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-black uppercase text-slate-400">
              Workspace /{" "}
              <span className="text-slate-900 dark:text-white">
                {currentProject?.name || "Infinite Canvas"}
              </span>
            </h2>
            {currentProject && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAddingScreen(true)}
                  className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all"
                  disabled={isAiBusy}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Screen
                </button>
                <button
                  onClick={handleSaveSnapshot}
                  className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all"
                  disabled={isAiBusy}
                  title="Save current workspace state"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save Workspace
                </button>
                <button
                  onClick={handleExportZip}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-md"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export ZIP
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setCurrentBreakpoint("desktop")}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${
                  currentBreakpoint === "desktop"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400"
                }`}
              >
                Desktop
              </button>
              <button
                onClick={() => setCurrentBreakpoint("tablet")}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${
                  currentBreakpoint === "tablet"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400"
                }`}
              >
                Tablet
              </button>
              <button
                onClick={() => setCurrentBreakpoint("mobile")}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${
                  currentBreakpoint === "mobile"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400"
                }`}
              >
                Mobile
              </button>
            </div>
          </div>
        </nav>
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            selectNodesOnDrag={true}
            minZoom={0.05}
            maxZoom={4}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color={appTheme === "dark" ? "#334155" : "#cbd5e1"}
            />
            {isAddingScreen && (
              <Panel position="top-center" className="mt-4">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] shadow-2xl p-6 w-[400px] animate-in slide-in-from-top-4 duration-300">
                  <header className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
                      New Context UIX
                    </h3>
                    <button
                      onClick={() => setIsAddingScreen(false)}
                      className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-400"
                    >
                      ✕
                    </button>
                  </header>
                  <textarea
                    autoFocus
                    value={newScreenPrompt}
                    onChange={(e) => setNewScreenPrompt(e.target.value)}
                    placeholder="e.g. 'A premium statistics page with line charts'"
                    className="w-full h-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all resize-none shadow-inner mb-4"
                  />
                  <button
                    onClick={handleGenerateNewScreen}
                    disabled={isGeneratingNewScreen || !newScreenPrompt.trim()}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-50"
                  >
                    {isGeneratingNewScreen
                      ? "Synthesizing..."
                      : "Generate New Screen"}
                  </button>
                </div>
              </Panel>
            )}
            <Panel position="bottom-center" className="mb-10">
              <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-[1.25rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md">
                <button
                  onClick={undo}
                  disabled={past.length === 0}
                  className="p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 transition-all active:scale-90"
                  title="Undo"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={redo}
                  disabled={future.length === 0}
                  className="p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 transition-all active:scale-90"
                  title="Redo"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
                <div className="w-[2px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 rounded-full" />
                <button
                  onClick={() => zoomIn()}
                  className="p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90"
                  title="Zoom In"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => zoomOut()}
                  className="p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90"
                  title="Zoom Out"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path d="M20 12H4" />
                  </svg>
                </button>
                <div className="w-[2px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 rounded-full" />
                <button
                  onClick={() => fitView({ padding: 0.2, duration: 800 })}
                  className="p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90"
                  title="Fit to View"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </Panel>
            {isGenerating && (
              <Panel
                position="top-center"
                className="!m-0 !top-1/2 !-translate-y-1/2"
              >
                <div className="flex flex-col items-center gap-8">
                  <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <h2 className="text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">
                    Synthesizing Architecture...
                  </h2>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </main>

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-8 modal-backdrop animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200 dark:border-slate-700">
            <header className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase text-slate-900 dark:text-white">
                  Workspace History
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Select a previous project UIX
                </p>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.length === 0 ? (
                <div className="col-span-full py-20 text-center opacity-30">
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                    No UIX history found
                  </p>
                </div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCurrentProject(p);
                      setMessages(p.chatHistory || []);
                      setIsHistoryOpen(false);
                      setTimeout(() => fitView({ padding: 0.3 }), 100);
                    }}
                    className={`p-6 text-left border rounded-[2rem] transition-all flex flex-col gap-3 group hover:border-indigo-500 hover:shadow-lg ${
                      currentProject?.id === p.id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-indigo-600 group-hover:text-indigo-500">
                      {p.data.architecture || "Web/App"}
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white truncate">
                      {p.name}
                    </h4>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] text-slate-400 uppercase">
                        {new Date(p.timestamp).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {new Date(p.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);
  if (isMobile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20 ring-4 ring-indigo-900/20">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-black mb-4 tracking-tight">
          Desktop Experience Required
        </h1>
        <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed font-medium">
          This application is optimized for larger screens. <br />
          <span className="text-indigo-400">
            This is not available in mobile for better experience use tablet or
            laptop or desktop.
          </span>
        </p>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
