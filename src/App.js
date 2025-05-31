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
  padding: 1.25rem;
  overflow-y: auto;
  box-sizing: border-box;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 50rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem 0;
`;

const StatusIndicator = styled.div`
  padding: 0.3125rem 0.625rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
  background-color: ${(props) => (props.$connected ? "#4CAF50" : "#F44336")};
  color: white;
`;

const HistoryList = styled.div`
  width: 100%;
  max-width: 50rem;

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    width: 100%;
    margin-bottom: 1rem;
  }
`;

const HistoryItem = styled.div`
  background: ${(props) => props.theme.menuBackground};
  border: 0.0625rem solid ${(props) => props.theme.border};
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
  padding: 0.9375rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  color: ${(props) => props.theme.text};
  font-family: ${(props) => props.theme.fontFamily};
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 0.5rem;
  background-color: ${(props) => props.theme.background};
  border: 0.0625rem solid ${(props) => props.theme.border};
  border-radius: 0.25rem;
  overflow: hidden;
  margin: 0.3125rem 0;
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
  margin: 0.625rem 0;
  background: #000;
  border-radius: 0.25rem;
  overflow: hidden;
`;

const AutoplayImage = styled.img`
  width: 100%;
  height: auto;
  display: ${(props) => (props.$isVisible ? "block" : "none")};
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.625rem;
`;

const ValidationMessage = styled.div`
  font-size: 1.25rem;
  padding: 1.25rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  text-align: center;
`;

const ErrorMessage = styled(ValidationMessage)`
  color: #dc3545;
`;

const AppStatusContainer = styled.div`
  font-size: 1.25rem;
  margin-bottom: 1.25rem;
  padding: 0.625rem;
  border-radius: 0.25rem;
  text-align: center;
`;

const NoAppMessage = styled(AppStatusContainer)`
  color: #666;
`;

const ThemeStatusContainer = styled.div`
  font-size: 1.25rem;
  margin-bottom: 1.25rem;
  padding: 0.625rem;
  border-radius: 0.25rem;
  text-align: center;
`;

const HistoryTitle = styled.h3`
  margin: 0;
`;

const LoadingStepsContainer = styled.div`
  font-size: 1.25rem;
  padding: 1.25rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  text-align: center;
  margin-bottom: 1.25rem;
`;

// Theme configuration mapping
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

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [, setSerialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [dataHistory, setDataHistory] = useState([]);
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
    const loadHistoryFromStorage = () => {
      const historyItems = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item.data && item.data.id) {
            historyItems.push(item);
          }
        } catch (error) {
          console.error("Error parsing history item:", error);
        }
      }
      historyItems.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setDataHistory(historyItems.slice(0, 10));
    };

    loadHistoryFromStorage();
  }, []);

  const saveHistoryItem = useCallback((item) => {
    if (item.data.id) {
      localStorage.setItem(item.data.id, JSON.stringify(item));
    }
  }, []);

  const clearHistory = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item.data && item.data.id) {
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.error("Error parsing history item:", error);
      }
    }
    setDataHistory([]);
  };

  const requestSerialData = () => {
    if (!isApiKeyValid || !socket || !connected) {
      return;
    }

    const apiKey = getApiKeyFromUrl();
    if (!apiKey || !isValidApiKeyFormat(apiKey)) {
      return;
    }

    socket.send(
      JSON.stringify({
        action: "getSerialData",
        apiKey
      })
    );
    setLoading(true);
    setSerialData(null);
  };

  const resendSerialData = (data) => {
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
        setSerialData(data);

        if (data.action === "currentTheme") {
          setCurrentTheme(data.data.theme);
          setHasReceivedTheme(true);
        }

        if (data.action === "currentApp") {
          setCurrentApp(data.data.appId);
          setHasReceivedApp(true);
          const historyItems = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
              const item = JSON.parse(localStorage.getItem(key));
              if (item.data?.data?.currentApp === data.data.appId) {
                historyItems.push(item);
              }
            } catch (error) {
              console.error("Error parsing history item:", error);
            }
          }
          historyItems.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          setDataHistory(historyItems.slice(0, 10));
        }

        if (data.action === "appChanged") {
          setCurrentApp(data.data.appId);
          if (data.data.appId === null) {
            setDataHistory([]);
          } else {
            const historyItems = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              try {
                const item = JSON.parse(localStorage.getItem(key));
                if (item.data?.data?.currentApp === data.data.appId) {
                  historyItems.push(item);
                }
              } catch (error) {
                console.error("Error parsing history item:", error);
              }
            }
            historyItems.sort(
              (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setDataHistory(historyItems.slice(0, 10));
          }
        }

        if (data.action === "screenshotData") {
          const itemId = data.id;
          if (!itemId) {
            console.error("No ID found in screenshot data");
            return;
          }

          const existingItem = localStorage.getItem(itemId);

          if (existingItem) {
            try {
              const item = JSON.parse(existingItem);
              if (!item.data.screenshots) {
                item.data.screenshots = [];
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

              // Save to localStorage and update state immediately
              localStorage.setItem(itemId, JSON.stringify(item));

              setDataHistory((prevHistory) => {
                const existingIndex = prevHistory.findIndex(
                  (entry) => entry.data.id === itemId
                );
                if (existingIndex !== -1) {
                  const updatedHistory = [...prevHistory];
                  updatedHistory[existingIndex] = item;
                  return updatedHistory;
                }
                return prevHistory;
              });

              uploadScreenshot(itemId, screenshotIndex, data.data)
                .then((screenshotUrl) => {
                  if (screenshotUrl) {
                    // Get the current state and find the screenshot to update
                    setDataHistory((prevHistory) => {
                      const existingIndex = prevHistory.findIndex(
                        (entry) => entry.data.id === itemId
                      );

                      if (existingIndex !== -1) {
                        const updatedHistory = [...prevHistory];
                        const updatedItem = {
                          ...updatedHistory[existingIndex]
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

                            updatedHistory[existingIndex] = updatedItem;
                            return updatedHistory;
                          }
                        }
                      }

                      return prevHistory;
                    });
                  } else {
                    // Mark as not uploading but keep the base64 data
                    setDataHistory((prevHistory) => {
                      const existingIndex = prevHistory.findIndex(
                        (entry) => entry.data.id === itemId
                      );

                      if (existingIndex !== -1) {
                        const updatedHistory = [...prevHistory];
                        const updatedItem = {
                          ...updatedHistory[existingIndex]
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

                            updatedHistory[existingIndex] = updatedItem;
                            return updatedHistory;
                          }
                        }
                      }
                      return prevHistory;
                    });
                  }
                })
                .catch((error) => {
                  console.error("screenshotData: upload promise rejected", {
                    itemId,
                    error: error.message,
                    stack: error.stack
                  });
                });
            } catch (error) {
              console.error("Error updating screenshot data:", error);
            }
          }
        }

        if (!data.action || data.action === "serialData") {
          setDataHistory((prevHistory) => {
            const existingIndex = prevHistory.findIndex(
              (entry) => entry.data.id === data.id
            );

            let newEntry;
            if (existingIndex !== -1) {
              // Preserve existing screenshots when updating
              const existingEntry = prevHistory[existingIndex];
              newEntry = {
                data: {
                  ...data,
                  screenshots: existingEntry.data.screenshots || []
                },
                timestamp: new Date().toISOString()
              };
            } else {
              // New entry starts with empty screenshots
              newEntry = {
                data: {
                  ...data,
                  screenshots: []
                },
                timestamp: new Date().toISOString()
              };
            }

            let updatedHistory;
            if (existingIndex !== -1) {
              updatedHistory = [...prevHistory];
              updatedHistory[existingIndex] = newEntry;
            } else {
              updatedHistory = [newEntry, ...prevHistory].slice(0, 10);
            }

            saveHistoryItem(newEntry);
            return updatedHistory;
          });
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to parse message data:", error);
        setSerialData({ error: "Failed to parse data" });
        setLoading(false);
      }
    },
    [
      uploadScreenshot,
      setSerialData,
      setCurrentTheme,
      setCurrentApp,
      setDataHistory,
      setLoading,
      saveHistoryItem
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
    };

    ws.onclose = () => {
      setConnected(false);
      setLoading(false);
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

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
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
    dataHistory.forEach((entry) => {
      if (entry.data.screenshots && entry.data.screenshots.length > 0) {
        if (entry.data.screenshots.length === 6) {
          startAutoplay(entry.data.id, entry.data.screenshots);
        } else {
          showLatestImage(entry.data.id, entry.data.screenshots);
        }
      }
    });
  }, [dataHistory, startAutoplay]);

  const filteredHistory = useMemo(() => {
    return dataHistory.filter(
      (entry) => entry?.data?.data?.currentApp === currentApp
    );
  }, [dataHistory, currentApp]);

  const deleteHistoryItem = async (itemId) => {
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

    setDataHistory((prevHistory) =>
      prevHistory.filter((entry) => entry.data.id !== itemId)
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
            <ErrorMessage>
              No API key provided. Please add an API key to the URL query
              parameters.
            </ErrorMessage>
          ) : !isApiKeyValid && !isValidatingApiKey ? (
            <ErrorMessage>
              Invalid API key. Please check your API key and try again.
            </ErrorMessage>
          ) : !isInitializationComplete ? (
            <LoadingStepsContainer>
              {initializationStep === "validating" && (
                <div>Validating API key...</div>
              )}
              {initializationStep === "connecting" && (
                <div>Connecting to server...</div>
              )}
              {initializationStep === "themes" && <div>Loading themes...</div>}
              {initializationStep === "app" && (
                <div>Getting current app and theme...</div>
              )}
            </LoadingStepsContainer>
          ) : (
            <>
              <StatusIndicator $connected={connected}>
                {connected ? "Connected" : "Disconnected"}
              </StatusIndicator>

              {currentApp ? (
                <AppStatusContainer>
                  Current App: {currentApp}
                </AppStatusContainer>
              ) : (
                <NoAppMessage>No app open</NoAppMessage>
              )}

              {currentTheme && (
                <ThemeStatusContainer>
                  Current Theme: {currentTheme}
                </ThemeStatusContainer>
              )}

              <Button
                variant="primary"
                fullWidth
                onClick={requestSerialData}
                disabled={!connected || loading}
              >
                {loading ? "Loading..." : "Request Current Serial Data"}
              </Button>

              {dataHistory.length > 0 && (
                <HistoryList>
                  <HistoryHeader>
                    <HistoryTitle>History:</HistoryTitle>
                    <Button variant="clear" size="small" onClick={clearHistory}>
                      Clear History
                    </Button>
                  </HistoryHeader>
                  <ul>
                    {filteredHistory.map((entry, index) => (
                      <li key={entry.timestamp}>
                        <HistoryItem>
                          <div>
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                          {entry.data.screenshots && (
                            <>
                              <ProgressBar>
                                <ProgressFill
                                  $progress={entry.data.screenshots.length}
                                />
                              </ProgressBar>
                            </>
                          )}
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
                          <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => resendSerialData(entry.data)}
                            disabled={
                              !connected ||
                              !entry.data.screenshots ||
                              entry.data.screenshots.length < 6
                            }
                          >
                            Send
                          </Button>
                          <Button
                            variant="danger"
                            fullWidth
                            onClick={() => deleteHistoryItem(entry.data.id)}
                            disabled={
                              !entry.data.screenshots ||
                              entry.data.screenshots.length < 6
                            }
                          >
                            Delete
                          </Button>
                        </HistoryItem>
                      </li>
                    ))}
                  </ul>
                </HistoryList>
              )}
            </>
          )}
        </ContentWrapper>
      </Page>
    </ThemeProvider>
  );
}

export default App;
