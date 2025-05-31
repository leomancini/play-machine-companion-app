import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from "react";
import styled from "styled-components";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  font-size: 24px;
  color: #333;
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0;
`;

const StatusIndicator = styled.div`
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 20px;
  background-color: ${(props) => (props.$connected ? "#4CAF50" : "#F44336")};
  color: white;
`;

const RequestButton = styled.button`
  padding: 12px 24px;
  font-size: 18px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;

  &:hover {
    background-color: #0052a3;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ClearHistoryButton = styled.button`
  padding: 8px 16px;
  font-size: 14px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;

  &:hover {
    background-color: #c82333;
  }
`;

const HistoryList = styled.div`
  width: 100%;
  max-width: 800px;

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
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin: 5px 0;
`;

const ProgressFill = styled.div`
  height: 100%;
  background-color: #0066cc;
  width: ${(props) => (props.$progress / 5) * 100}%;
  transition: width 0.3s ease;
`;

const AutoplayContainer = styled.div`
  position: relative;
  width: 100%;
  margin: 10px 0;
  background: #000;
  border-radius: 4px;
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
  margin-bottom: 10px;
`;

const ResendButton = styled.button`
  padding: 12px 24px;
  font-size: 18px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;

  &:hover {
    background-color: #218838;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const DeleteButton = styled.button`
  padding: 12px 24px;
  font-size: 18px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  margin-top: 10px;

  &:hover {
    background-color: #c82333;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

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
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY = 1000;
  const socketRef = useRef(null);
  const [autoplayStates, setAutoplayStates] = useState({});
  const autoplayIntervals = useRef({});
  const MAX_API_KEY_LENGTH = 256;
  const API_KEY_REGEX = useMemo(() => /^[a-zA-Z0-9]+$/, []);

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
        }

        if (data.action === "currentApp") {
          setCurrentApp(data.data.appId);
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
    handleWebSocketMessage
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

  return (
    <Page>
      <ContentWrapper>
        {isValidatingApiKey ? (
          <div
            style={{
              fontSize: "20px",
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textAlign: "center"
            }}
          >
            Validating API key...
          </div>
        ) : !getApiKeyFromUrl() ? (
          <div
            style={{
              fontSize: "20px",
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textAlign: "center",
              color: "#dc3545"
            }}
          >
            No API key provided. Please add an API key to the URL query
            parameters.
          </div>
        ) : !isApiKeyValid ? (
          <div
            style={{
              fontSize: "20px",
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textAlign: "center",
              color: "#dc3545"
            }}
          >
            Invalid API key. Please check your API key and try again.
          </div>
        ) : (
          <>
            <StatusIndicator $connected={connected}>
              {connected ? "Connected" : "Disconnected"}
            </StatusIndicator>

            {currentApp ? (
              <div
                style={{
                  fontSize: "20px",
                  marginBottom: "20px",
                  padding: "10px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  textAlign: "center"
                }}
              >
                Current App: {currentApp}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "20px",
                  marginBottom: "20px",
                  padding: "10px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  textAlign: "center",
                  color: "#666"
                }}
              >
                No app open
              </div>
            )}

            {currentTheme && (
              <div
                style={{
                  fontSize: "20px",
                  marginBottom: "20px",
                  padding: "10px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  textAlign: "center"
                }}
              >
                Current Theme: {currentTheme}
              </div>
            )}

            <RequestButton
              onClick={requestSerialData}
              disabled={!connected || loading}
            >
              {loading ? "Loading..." : "Request Current Serial Data"}
            </RequestButton>

            {dataHistory.length > 0 && (
              <HistoryList>
                <HistoryHeader>
                  <h3 style={{ margin: 0 }}>History:</h3>
                  <ClearHistoryButton onClick={clearHistory}>
                    Clear History
                  </ClearHistoryButton>
                </HistoryHeader>
                <ul>
                  {filteredHistory.map((entry, index) => (
                    <li key={entry.timestamp}>
                      <HistoryItem>
                        <div>{new Date(entry.timestamp).toLocaleString()}</div>
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
                        <ResendButton
                          onClick={() => resendSerialData(entry.data)}
                          disabled={
                            !connected ||
                            !entry.data.screenshots ||
                            entry.data.screenshots.length < 6
                          }
                        >
                          Send
                        </ResendButton>
                        <DeleteButton
                          onClick={() => deleteHistoryItem(entry.data.id)}
                          disabled={
                            !entry.data.screenshots ||
                            entry.data.screenshots.length < 6
                          }
                        >
                          Delete
                        </DeleteButton>
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
  );
}

export default App;
