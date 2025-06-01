import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from "react";
import styled, { ThemeProvider } from "styled-components";
import Button from "./components/Button";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  font-size: 1.5rem;
  color: ${(props) => props.theme.text};
  background-color: ${(props) => props.theme.background};
  font-family: ${(props) => props.theme.fontFamily};
  text-transform: ${(props) => props.theme.textTransform};
  overflow-y: auto;
  box-sizing: border-box;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 50rem;
  height: 100vh;
  display: flex;
  flex-direction: column;
`;

const StatusIndicator = styled.div`
  padding: 0.5rem 1rem;
  font-size: 1rem;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
`;

const AppPresetsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  gap: 2.5rem;
`;

const AppNameHeader = styled.div`
  font-size: 1.75rem;
  margin-top: 1rem;
  padding: 0.5rem;
  text-align: center;
  font-weight: bold;
`;

const NoAppMessage = styled.div`
  font-weight: normal;
  font-size: 1.25rem;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PresetsList = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const PresetItem = styled.div`
  background: ${(props) => props.theme.background};
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: ${(props) => props.theme.text};
  font-family: ${(props) => props.theme.fontFamily};
`;

const PresetItemHeader = styled.div`
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 0.5rem;
  background-color: ${(props) => props.theme.background};
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background-color: ${(props) => props.theme.accent};
  width: ${(props) => (props.$progress / 5) * 100}%;
  transition: width 0.3s ease;
`;

const AutoplayContainer = styled.div`
  position: relative;
  width: 100%;
  background: #000;
  overflow: hidden;
`;

const AutoplayImage = styled.img`
  width: 100%;
  height: auto;
  display: ${(props) => (props.$isVisible ? "block" : "none")};
`;

const defaultTheme = {
  accent: "rgba(0, 102, 204, 1)",
  background: "#ffffff",
  border: "rgba(0, 102, 204, 0.3)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  menuBackground: "#f8f9fa",
  menuSelectedBackground: "rgba(0, 102, 204, 1)",
  menuSelectedText: "#ffffff",
  menuText: "#333333",
  text: "#333333",
  textTransform: "none"
};

// Utility function to format camelCase strings with spaces
const formatAppName = (appName) => {
  if (!appName || typeof appName !== "string") return appName;
  return appName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [, setSerialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [dataPresets, setDataPresets] = useState([]);
  const [currentApp, setCurrentApp] = useState(null);
  const [currentTheme, setCurrentTheme] = useState(null);
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(true);
  const [themes, setThemes] = useState([]);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [initializationStep, setInitializationStep] = useState("validating"); // validating, connecting, themes, app, ready
  const [hasReceivedTheme, setHasReceivedTheme] = useState(false);
  const [hasReceivedApp, setHasReceivedApp] = useState(false);
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY = 1000;
  const socketRef = useRef(null);
  const [autoplayStates, setAutoplayStates] = useState({});
  const autoplayIntervals = useRef({});
  const uploadingScreenshots = useRef(new Map());
  const loadingRef = useRef(false);
  const recentPresetIds = useRef(new Set());
  const MAX_API_KEY_LENGTH = 256;
  const API_KEY_REGEX = useMemo(() => /^[a-zA-Z0-9]+$/, []);

  // Get the current theme object based on the current theme data from API
  const currentThemeObject = useMemo(() => {
    if (currentTheme && Object.keys(themes).length > 0) {
      // Check if the current theme exists in the themes object
      if (themes[currentTheme]) {
        return {
          ...defaultTheme,
          ...themes[currentTheme]
        };
      }
    }
    return defaultTheme;
  }, [currentTheme, themes]);

  // Update CSS custom properties when theme changes
  useEffect(() => {
    if (currentThemeObject) {
      document.documentElement.style.setProperty(
        "--theme-background",
        currentThemeObject.background
      );
      document.documentElement.style.setProperty(
        "--theme-text",
        currentThemeObject.text
      );
      document.documentElement.style.setProperty(
        "--theme-accent",
        currentThemeObject.accent
      );
    }
  }, [currentThemeObject]);

  const isValidApiKeyFormat = useCallback(
    (apiKey) => {
      if (!apiKey || typeof apiKey !== "string") return false;
      if (apiKey.length < 24 || apiKey.length > MAX_API_KEY_LENGTH)
        return false;
      if (!API_KEY_REGEX.test(apiKey)) return false;
      return true;
    },
    [API_KEY_REGEX]
  );

  const getApiKeyFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const apiKey = params.get("apiKey");
    return apiKey ? apiKey.trim() : null;
  };

  const getApiUrl = () => {
    return process.env.NODE_ENV === "production"
      ? "https://play-machine-server.noshado.ws/api"
      : "http://localhost:3205/api";
  };

  const fetchThemes = useCallback(async () => {
    setIsLoadingThemes(true);
    try {
      const response = await fetch(`${getApiUrl()}/themes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("fetchThemes: response not ok", {
          status: response.status,
          errorText
        });
        throw new Error(
          `Failed to fetch themes: ${response.status} ${errorText}`
        );
      }

      const themesData = await response.json();
      setThemes(themesData);
      setInitializationStep("app");
    } catch (error) {
      console.error("Error fetching themes:", error);
      setThemes([]);
      setInitializationStep("app");
    } finally {
      setIsLoadingThemes(false);
    }
  }, []);

  const uploadScreenshot = useCallback(async (id, index, data) => {
    try {
      // Validate inputs
      if (!id) {
        console.error("uploadScreenshot: missing id", {
          id,
          index,
          data: data ? "present" : "missing"
        });
        return null;
      }
      if (index === undefined || index === null) {
        console.error("uploadScreenshot: missing index", {
          id,
          index,
          data: data ? "present" : "missing"
        });
        return null;
      }
      if (!data) {
        console.error("uploadScreenshot: missing data", {
          id,
          index,
          data: data ? "present" : "missing"
        });
        return null;
      }

      const apiKey = getApiKeyFromUrl();
      if (!apiKey) {
        console.error("uploadScreenshot: missing API key");
        return null;
      }

      const cleanedData = data.replace(/^data:image\/png;base64,/, "");
      const payload = {
        id,
        index,
        data: cleanedData,
        apiKey
      };

      const response = await fetch(`${getApiUrl()}/save-screenshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("uploadScreenshot: response not ok", {
          status: response.status,
          errorText
        });
        throw new Error(
          `Failed to upload screenshot: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();

      // Construct the proper server URL using the returned path
      let screenshotUrl = result.path;

      if (screenshotUrl) {
        const serverBaseUrl =
          process.env.NODE_ENV === "production"
            ? "https://play-machine-server.noshado.ws"
            : "http://localhost:3205";

        screenshotUrl = `${serverBaseUrl}/api/${screenshotUrl}`;
      }

      return screenshotUrl;
    } catch (error) {
      console.error("Error uploading screenshot:", error);
      return null;
    }
  }, []);

  const validateApiKey = useCallback(
    async (apiKey) => {
      if (!apiKey) {
        setIsApiKeyValid(false);
        setIsValidatingApiKey(false);
        return;
      }

      if (!isValidApiKeyFormat(apiKey)) {
        setIsApiKeyValid(false);
        setIsValidatingApiKey(false);
        return;
      }

      try {
        const response = await fetch(
          `${getApiUrl()}/validate-api-key?apiKey=${encodeURIComponent(apiKey)}`
        );

        if (!response.ok) {
          throw new Error("Validation request failed");
        }

        const data = await response.json();
        setIsApiKeyValid(data.valid);
        if (data.valid) {
          setInitializationStep("connecting");
        }
      } catch (error) {
        console.error("Error validating API key:", error);
        setIsApiKeyValid(false);
      } finally {
        setIsValidatingApiKey(false);
      }
    },
    [isValidApiKeyFormat]
  );

  useEffect(() => {
    const apiKey = getApiKeyFromUrl();
    validateApiKey(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadPresetsFromStorage = () => {
      const presetItems = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item.data && item.data.id) {
            presetItems.push(item);
          }
        } catch (error) {
          console.error("Error parsing preset item:", error);
        }
      }
      presetItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setDataPresets(presetItems.slice(0, 10));
    };

    loadPresetsFromStorage();
  }, []);

  const savePresetsItem = useCallback((item) => {
    if (item.data.id) {
      localStorage.setItem(item.data.id, JSON.stringify(item));
    }
  }, []);

  // eslint-disable-next-line no-unused-vars
  const clearPresets = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item.data && item.data.id) {
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.error("Error parsing preset item:", error);
      }
    }
    setDataPresets([]);
  };

  const requestSerialData = useCallback(() => {
    if (
      !isApiKeyValid ||
      !socket ||
      !connected ||
      loading ||
      loadingRef.current
    ) {
      return;
    }

    const apiKey = getApiKeyFromUrl();
    if (!apiKey || !isValidApiKeyFormat(apiKey)) {
      return;
    }

    // Set both the ref and state to prevent race conditions
    loadingRef.current = true;
    setLoading(true);

    const requestId = Date.now().toString();
    socket.send(
      JSON.stringify({
        action: "getSerialData",
        requestId,
        apiKey
      })
    );
    setSerialData(null);
  }, [isApiKeyValid, socket, connected, loading, isValidApiKeyFormat]);

  const sendSerialData = (data) => {
    if (!isApiKeyValid || !socket || !connected) {
      return;
    }

    const apiKey = getApiKeyFromUrl();
    if (!apiKey || !isValidApiKeyFormat(apiKey)) {
      return;
    }

    socket.send(
      JSON.stringify({
        action: "setSerialData",
        data,
        apiKey
      })
    );
  };

  const handleWebSocketMessage = useCallback(
    async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket event received:", data);
        setSerialData(data);

        if (data.action === "currentTheme") {
          setCurrentTheme(data.data.theme);
          setHasReceivedTheme(true);
        }

        if (data.action === "currentApp") {
          setCurrentApp(data.data.appId);
          setHasReceivedApp(true);
          const presetItems = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
              const item = JSON.parse(localStorage.getItem(key));
              if (item.data?.data?.currentApp === data.data.appId) {
                presetItems.push(item);
              }
            } catch (error) {
              console.error("Error parsing preset item:", error);
            }
          }
          presetItems.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          setDataPresets(presetItems.slice(0, 10));
        }

        if (data.action === "appChanged") {
          setCurrentApp(data.data.appId);
          if (data.data.appId === null) {
            setDataPresets([]);
          } else {
            const presetItems = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              try {
                const item = JSON.parse(localStorage.getItem(key));
                if (item.data?.data?.currentApp === data.data.appId) {
                  presetItems.push(item);
                }
              } catch (error) {
                console.error("Error parsing preset item:", error);
              }
            }
            presetItems.sort(
              (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setDataPresets(presetItems.slice(0, 10));
          }
        }

        if (data.action === "screenshotData") {
          const itemId = data.data?.id || data.id;
          console.log("Processing screenshotData for itemId:", itemId);
          console.log(
            "screenshotData structure - data.id:",
            data.id,
            "data.data?.id:",
            data.data?.id
          );
          if (!itemId) {
            console.error("No ID found in screenshot data");
            return;
          }

          const existingItem = localStorage.getItem(itemId);
          console.log("Existing item found in localStorage:", !!existingItem);

          if (existingItem) {
            try {
              const item = JSON.parse(existingItem);
              if (!item.data.screenshots) {
                item.data.screenshots = [];
              }

              console.log(
                "Current screenshots count:",
                item.data.screenshots.length
              );

              // Create a unique key for this screenshot to prevent duplicates
              const screenshotKey = `${itemId}-${item.data.screenshots.length}`;

              // Check if this screenshot is already being uploaded
              if (uploadingScreenshots.current.has(screenshotKey)) {
                console.log(
                  "Screenshot already being processed, skipping duplicate:",
                  screenshotKey
                );
                return;
              }

              // Calculate the screenshot index
              const screenshotIndex = item.data.screenshots.length + 1;

              // Immediately add the base64 data so it shows up right away
              const screenshotEntry = {
                timestamp: new Date().toISOString(),
                data: data.data, // Use the base64 data directly
                isUploading: true
              };

              item.data.screenshots.push(screenshotEntry);
              item.data.screenshots = item.data.screenshots.slice(-6);

              console.log(
                "Updated screenshots count:",
                item.data.screenshots.length
              );

              // Save to localStorage and update state immediately
              localStorage.setItem(itemId, JSON.stringify(item));

              setDataPresets((prevPresets) => {
                const existingIndex = prevPresets.findIndex(
                  (entry) => entry.data.id === itemId
                );
                console.log("Found existing preset index:", existingIndex);
                if (existingIndex !== -1) {
                  const updatedPresets = [...prevPresets];
                  updatedPresets[existingIndex] = item;
                  return updatedPresets;
                }
                return prevPresets;
              });

              // Mark as being uploaded to prevent duplicates
              const uploadPromise = uploadScreenshot(
                itemId,
                screenshotIndex,
                data.data
              )
                .then((screenshotUrl) => {
                  if (screenshotUrl) {
                    // Get the current state and find the screenshot to update
                    setDataPresets((prevPresets) => {
                      const existingIndex = prevPresets.findIndex(
                        (entry) => entry.data.id === itemId
                      );

                      if (existingIndex !== -1) {
                        const updatedPresets = [...prevPresets];
                        const updatedItem = {
                          ...updatedPresets[existingIndex]
                        };

                        // Find the screenshot with the matching timestamp and update it
                        if (updatedItem.data && updatedItem.data.screenshots) {
                          const screenshotToUpdateIndex =
                            updatedItem.data.screenshots.findIndex(
                              (screenshot) =>
                                screenshot.timestamp ===
                                screenshotEntry.timestamp
                            );

                          if (screenshotToUpdateIndex !== -1) {
                            updatedItem.data.screenshots = [
                              ...updatedItem.data.screenshots
                            ];
                            updatedItem.data.screenshots[
                              screenshotToUpdateIndex
                            ] = {
                              timestamp: screenshotEntry.timestamp,
                              data: screenshotUrl,
                              isUploading: false
                            };

                            // Update localStorage
                            localStorage.setItem(
                              itemId,
                              JSON.stringify(updatedItem)
                            );

                            updatedPresets[existingIndex] = updatedItem;
                            return updatedPresets;
                          }
                        }
                      }

                      return prevPresets;
                    });
                  } else {
                    // Mark as not uploading but keep the base64 data
                    setDataPresets((prevPresets) => {
                      const existingIndex = prevPresets.findIndex(
                        (entry) => entry.data.id === itemId
                      );

                      if (existingIndex !== -1) {
                        const updatedPresets = [...prevPresets];
                        const updatedItem = {
                          ...updatedPresets[existingIndex]
                        };

                        if (updatedItem.data && updatedItem.data.screenshots) {
                          const screenshotToUpdateIndex =
                            updatedItem.data.screenshots.findIndex(
                              (screenshot) =>
                                screenshot.timestamp ===
                                screenshotEntry.timestamp
                            );

                          if (screenshotToUpdateIndex !== -1) {
                            updatedItem.data.screenshots = [
                              ...updatedItem.data.screenshots
                            ];
                            updatedItem.data.screenshots[
                              screenshotToUpdateIndex
                            ].isUploading = false;

                            // Update localStorage
                            localStorage.setItem(
                              itemId,
                              JSON.stringify(updatedItem)
                            );

                            updatedPresets[existingIndex] = updatedItem;
                            return updatedPresets;
                          }
                        }
                      }
                      return prevPresets;
                    });
                  }
                })
                .catch((error) => {
                  console.error("screenshotData: upload promise rejected", {
                    itemId,
                    error: error.message,
                    stack: error.stack
                  });
                })
                .finally(() => {
                  // Clean up the tracking entry when upload completes
                  uploadingScreenshots.current.delete(screenshotKey);
                });

              // Store the promise to track this upload
              uploadingScreenshots.current.set(screenshotKey, uploadPromise);
            } catch (error) {
              console.error("Error updating screenshot data:", error);
            }
          }
        }

        if (!data.action || data.action === "serialData") {
          // Extract ID if available
          const itemId = data.data?.id || data.id;

          // Add deduplication check to prevent server-side duplicates
          const recentKey = `${itemId}-recent`;

          // Check if we've processed this preset ID very recently (within 2 seconds)
          if (itemId && recentPresetIds.current.has(recentKey)) {
            console.log("Skipping duplicate preset data from server:", itemId);
            setLoading(false);
            loadingRef.current = false;
            return;
          }

          // Mark this preset ID as recently processed
          if (itemId) {
            recentPresetIds.current.add(recentKey);
          }

          console.log(
            "Processing preset data:",
            itemId || "no-id",
            "at",
            new Date().toISOString()
          );

          // Clear the tracking after 2 seconds
          if (itemId) {
            setTimeout(() => {
              recentPresetIds.current.delete(recentKey);
            }, 2000);
          }

          setDataPresets((prevPresets) => {
            const existingIndex = itemId
              ? prevPresets.findIndex((entry) => entry.data.id === itemId)
              : -1;

            let newEntry;
            if (existingIndex !== -1) {
              // Preserve existing screenshots when updating
              const existingEntry = prevPresets[existingIndex];
              newEntry = {
                data: {
                  ...data,
                  id: itemId, // Ensure the ID is set correctly
                  screenshots: existingEntry.data.screenshots || []
                },
                timestamp: new Date().toISOString()
              };
            } else {
              // New entry starts with empty screenshots
              newEntry = {
                data: {
                  ...data,
                  id: itemId, // Ensure the ID is set correctly
                  screenshots: []
                },
                timestamp: new Date().toISOString()
              };
            }

            // Immediately save to localStorage so screenshotData can find it
            if (itemId) {
              localStorage.setItem(itemId, JSON.stringify(newEntry));
              console.log("Saved preset to localStorage with ID:", itemId);
            }

            let updatedPresets;
            if (existingIndex !== -1) {
              updatedPresets = [...prevPresets];
              updatedPresets[existingIndex] = newEntry;
            } else {
              updatedPresets = [newEntry, ...prevPresets].slice(0, 10);
            }

            savePresetsItem(newEntry);
            return updatedPresets;
          });
        }
        setLoading(false);
        loadingRef.current = false;
      } catch (error) {
        console.error("Failed to parse message data:", error);
        setSerialData({ error: "Failed to parse data" });
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [
      uploadScreenshot,
      setSerialData,
      setCurrentTheme,
      setCurrentApp,
      setDataPresets,
      setLoading,
      savePresetsItem
    ]
  );

  const connectWebSocket = useCallback(() => {
    if (!isApiKeyValid) {
      return;
    }

    const apiKey = getApiKeyFromUrl();
    if (!apiKey || !isValidApiKeyFormat(apiKey)) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.close();
    }

    const WEBSOCKET_URL =
      process.env.NODE_ENV === "production"
        ? "wss://play-machine-server.noshado.ws/"
        : "ws://localhost:3103/";

    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setRetryCount(0);
      setSocket(ws);
      setInitializationStep("themes");

      // Fetch themes when WebSocket connects
      fetchThemes();

      ws.send(
        JSON.stringify({
          action: "getCurrentApp",
          apiKey
        })
      );
      ws.send(
        JSON.stringify({
          action: "getCurrentTheme",
          apiKey
        })
      );
    };

    ws.onmessage = handleWebSocketMessage;

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setLoading(false);
      loadingRef.current = false;
    };

    ws.onclose = () => {
      setConnected(false);
      setLoading(false);
      loadingRef.current = false;
      setSocket(null);

      if (socketRef.current === ws && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);

        setTimeout(() => {
          setRetryCount((prevCount) => prevCount + 1);
          connectWebSocket();
        }, delay);
      } else if (retryCount >= MAX_RETRIES) {
        console.error(
          "Maximum retry attempts reached. Please check your connection and refresh the page."
        );
      }
    };
  }, [
    isApiKeyValid,
    isValidApiKeyFormat,
    retryCount,
    MAX_RETRIES,
    INITIAL_RETRY_DELAY,
    handleWebSocketMessage,
    fetchThemes
  ]);

  useEffect(() => {
    connectWebSocket();

    // Capture the current ref values to use in cleanup
    const currentUploadingScreenshots = uploadingScreenshots.current;
    const currentRecentPresetIds = recentPresetIds.current;

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      // Clear any pending upload tracking using the captured ref value
      currentUploadingScreenshots.clear();
      // Reset loading state
      loadingRef.current = false;
      // Clear recent preset tracking using the captured ref value
      currentRecentPresetIds.clear();
    };
  }, [connectWebSocket]);

  const showLatestImage = (itemId, screenshots) => {
    const latestIndex = screenshots.length - 1;
    setAutoplayStates((prev) => ({
      ...prev,
      [itemId]: {
        currentIndex: latestIndex,
        isPlaying: false
      }
    }));
  };

  const startAutoplay = useCallback((itemId, screenshots) => {
    if (screenshots.length !== 6) {
      showLatestImage(itemId, screenshots);
      return;
    }

    if (autoplayIntervals.current[itemId]) {
      clearInterval(autoplayIntervals.current[itemId]);
    }

    setAutoplayStates((prev) => ({
      ...prev,
      [itemId]: {
        currentIndex: 0,
        isPlaying: true
      }
    }));

    autoplayIntervals.current[itemId] = setInterval(() => {
      setAutoplayStates((prev) => {
        const item = prev[itemId];
        if (!item) return prev;

        const nextIndex = (item.currentIndex + 1) % screenshots.length;
        return {
          ...prev,
          [itemId]: {
            ...item,
            currentIndex: nextIndex
          }
        };
      });
    }, 200);
  }, []);

  useEffect(() => {
    const intervals = autoplayIntervals.current;
    return () => {
      Object.values(intervals).forEach((interval) => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  useEffect(() => {
    dataPresets.forEach((entry) => {
      if (entry.data.screenshots && entry.data.screenshots.length > 0) {
        if (entry.data.screenshots.length === 6) {
          startAutoplay(entry.data.id, entry.data.screenshots);
        } else {
          showLatestImage(entry.data.id, entry.data.screenshots);
        }
      }
    });
  }, [dataPresets, startAutoplay]);

  const filteredPresets = useMemo(() => {
    return dataPresets.filter(
      (entry) => entry?.data?.data?.currentApp === currentApp
    );
  }, [dataPresets, currentApp]);

  // Check if any preset is currently being saved (has less than 6 screenshots)
  const isAnyPresetBeingSaved = useMemo(() => {
    return filteredPresets.some(
      (entry) => entry.data.screenshots && entry.data.screenshots.length < 6
    );
  }, [filteredPresets]);

  const deletePresetItem = async (itemId) => {
    try {
      const apiKey = getApiKeyFromUrl();
      if (apiKey && isValidApiKeyFormat(apiKey)) {
        // Call the delete endpoint
        const response = await fetch(
          `${getApiUrl()}/delete-screenshots/${itemId}?apiKey=${encodeURIComponent(
            apiKey
          )}`,
          {
            method: "DELETE"
          }
        );

        if (!response.ok) {
          console.error(
            "Failed to delete screenshots from server:",
            response.status
          );
        }
      }
    } catch (error) {
      console.error("Error deleting screenshots from server:", error);
    }

    // Remove from localStorage and update local state regardless of API call result
    localStorage.removeItem(itemId);

    setDataPresets((prevPresets) =>
      prevPresets.filter((entry) => entry.data.id !== itemId)
    );
  };

  // Check if initialization is complete
  useEffect(() => {
    if (hasReceivedTheme && hasReceivedApp && initializationStep === "app") {
      setInitializationStep("ready");
    }
  }, [hasReceivedTheme, hasReceivedApp, initializationStep]);

  // Also check if we should transition to ready state based on available data
  useEffect(() => {
    if (
      connected &&
      !isLoadingThemes &&
      themes &&
      Object.keys(themes).length > 0 &&
      hasReceivedTheme &&
      hasReceivedApp
    ) {
      setInitializationStep("ready");
    }
  }, [connected, isLoadingThemes, themes, hasReceivedTheme, hasReceivedApp]);

  const isInitializationComplete = initializationStep === "ready";

  return (
    <ThemeProvider theme={currentThemeObject}>
      <Page>
        <ContentWrapper>
          {!getApiKeyFromUrl() ? (
            <StatusIndicator>No API key</StatusIndicator>
          ) : !isApiKeyValid && !isValidatingApiKey ? (
            <StatusIndicator>API key invalid</StatusIndicator>
          ) : !isInitializationComplete ? (
            <StatusIndicator>
              {initializationStep === "validating" && "Checking API key..."}
              {initializationStep === "connecting" && "Connecting..."}
              {initializationStep === "themes" && "Loading themes..."}
              {initializationStep === "app" && "Getting current state..."}
            </StatusIndicator>
          ) : (
            <>
              {!connected && <StatusIndicator>Disconnected</StatusIndicator>}

              {currentApp ? (
                <AppPresetsContainer>
                  <AppNameHeader>{formatAppName(currentApp)}</AppNameHeader>
                  <StatusIndicator>
                    {connected ? "Connected" : "Disconnected"}
                  </StatusIndicator>

                  <StatusIndicator>
                    {loading ? "Loading..." : "Ready"}
                  </StatusIndicator>

                  <StatusIndicator>
                    {isAnyPresetBeingSaved ? "Saving..." : "Ready"}
                  </StatusIndicator>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={requestSerialData}
                    disabled={!connected || loading || isAnyPresetBeingSaved}
                  >
                    Save Preset
                  </Button>
                  {dataPresets.length > 0 && (
                    <PresetsList>
                      {filteredPresets.map((entry, index) => (
                        <PresetItem key={entry.timestamp}>
                          <PresetItemHeader>
                            {new Date(entry.timestamp).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric"
                              }
                            ) +
                              " at " +
                              new Date(entry.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true
                                }
                              )}
                          </PresetItemHeader>
                          {entry.data.screenshots &&
                            entry.data.screenshots.length > 0 && (
                              <AutoplayContainer>
                                {entry.data.screenshots.map(
                                  (screenshot, index) => {
                                    const isVisible =
                                      autoplayStates[entry.data.id]
                                        ?.currentIndex === index;
                                    return (
                                      <AutoplayImage
                                        key={index}
                                        src={screenshot.data}
                                        alt={`Screenshot ${index + 1}`}
                                        $isVisible={isVisible}
                                      />
                                    );
                                  }
                                )}
                              </AutoplayContainer>
                            )}
                          {entry.data.screenshots &&
                            entry.data.screenshots.length < 6 && (
                              <>
                                <ProgressBar>
                                  <ProgressFill
                                    $progress={entry.data.screenshots.length}
                                  />
                                </ProgressBar>
                              </>
                            )}
                          {entry.data.screenshots &&
                            entry.data.screenshots.length >= 6 && (
                              <>
                                <Button
                                  variant="primary"
                                  fullWidth
                                  onClick={() => sendSerialData(entry.data)}
                                  disabled={!connected}
                                >
                                  Load
                                </Button>
                                <Button
                                  variant="secondary"
                                  fullWidth
                                  onClick={() =>
                                    deletePresetItem(entry.data.id)
                                  }
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                        </PresetItem>
                      ))}
                    </PresetsList>
                  )}
                </AppPresetsContainer>
              ) : (
                <NoAppMessage>Open app to save preset</NoAppMessage>
              )}
            </>
          )}
        </ContentWrapper>
      </Page>
    </ThemeProvider>
  );
}

export default App;
