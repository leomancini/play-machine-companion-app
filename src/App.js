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
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY = 1000;
  const socketRef = useRef(null);
  const [autoplayStates, setAutoplayStates] = useState({});
  const autoplayIntervals = useRef({});

  useEffect(() => {
    // Load existing data from localStorage on mount
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
      // Sort by timestamp descending
      historyItems.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setDataHistory(historyItems.slice(0, 10));
    };

    loadHistoryFromStorage();
  }, []);

  const saveHistoryItem = (item) => {
    if (item.data.id) {
      localStorage.setItem(item.data.id, JSON.stringify(item));
    }
  };

  const clearHistory = () => {
    // Clear all history items from localStorage
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

  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const WEBSOCKET_URL =
      process.env.NODE_ENV === "production"
        ? "wss://play-machine-server.noshado.ws/"
        : "ws://localhost:3103";

    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setRetryCount(0);
      setSocket(ws);
      // Request current app state when connection is established
      ws.send(JSON.stringify({ action: "getCurrentApp" }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSerialData(data);

        // Handle current app state
        if (data.action === "currentApp") {
          setCurrentApp(data.data.appId);
          // Load history items for the current app
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
          // Sort by timestamp descending
          historyItems.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          setDataHistory(historyItems.slice(0, 10));
        }

        // Handle app change events
        if (data.action === "appChanged") {
          setCurrentApp(data.data.appId);
          // Clear history when app is exited
          if (data.data.appId === null) {
            setDataHistory([]);
          } else {
            // Load history items for the new app
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
            // Sort by timestamp descending
            historyItems.sort(
              (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setDataHistory(historyItems.slice(0, 10));
          }
        }

        // Handle screenshot data
        if (data.action === "screenshotData") {
          // Get existing item from localStorage
          const itemId = data.id;
          if (!itemId) {
            console.error("No ID found in screenshot data");
            return;
          }

          const existingItem = localStorage.getItem(itemId);

          if (existingItem) {
            try {
              const item = JSON.parse(existingItem);
              // Update with screenshot data
              if (!item.data.screenshots) {
                item.data.screenshots = [];
              }
              item.data.screenshots.push({
                timestamp: new Date().toISOString(),
                data: data.data
              });
              // Keep only the last 6 screenshots
              item.data.screenshots = item.data.screenshots.slice(-6);
              // Save back to localStorage
              localStorage.setItem(itemId, JSON.stringify(item));

              // Update state
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
            } catch (error) {
              console.error("Error updating screenshot data:", error);
            }
          }
        }

        // Add to history if it's a server response or serialData response
        if (!data.action || data.action === "serialData") {
          const newEntry = {
            data: {
              ...data,
              screenshots: [] // Initialize with empty screenshots array
            },
            timestamp: new Date().toISOString()
          };
          setDataHistory((prevHistory) => {
            const existingIndex = prevHistory.findIndex(
              (entry) => entry.data.id === data.id
            );

            let updatedHistory;
            if (existingIndex !== -1) {
              // Update existing entry
              updatedHistory = [...prevHistory];
              updatedHistory[existingIndex] = newEntry;
            } else {
              // Add new entry
              updatedHistory = [newEntry, ...prevHistory].slice(0, 10);
            }

            // Save the new/updated item to localStorage
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
    };

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
  }, [retryCount, MAX_RETRIES, INITIAL_RETRY_DELAY]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const requestSerialData = () => {
    if (socket && connected) {
      socket.send(JSON.stringify({ action: "getSerialData" }));
      setLoading(true);
      setSerialData(null);
    }
  };

  const resendSerialData = (data) => {
    if (socket && connected) {
      socket.send(JSON.stringify({ action: "setSerialData", data }));
    }
  };

  // Show latest image when available
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

  // Start autoplay for a history item
  const startAutoplay = useCallback((itemId, screenshots) => {
    // Only start autoplay if we have exactly 6 screenshots
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
    }, 200); // Change image every 200ms
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    const intervals = autoplayIntervals.current;
    return () => {
      Object.values(intervals).forEach((interval) => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  // Handle screenshots when they become available
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
      (entry) => entry.data.data.currentApp === currentApp
    );
  }, [dataHistory, currentApp]);

  const deleteHistoryItem = (itemId) => {
    // Remove from localStorage
    localStorage.removeItem(itemId);

    // Update state
    setDataHistory((prevHistory) =>
      prevHistory.filter((entry) => entry.data.id !== itemId)
    );
  };

  return (
    <Page>
      <ContentWrapper>
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
                          {entry.data.screenshots.map((screenshot, index) => (
                            <AutoplayImage
                              key={index}
                              src={`data:image/png;base64,${screenshot.data.replace(
                                /^data:image\/png;base64,/,
                                ""
                              )}`}
                              alt={`Screenshot ${index + 1}`}
                              $isVisible={
                                autoplayStates[entry.data.id]?.currentIndex ===
                                index
                              }
                            />
                          ))}
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
      </ContentWrapper>
    </Page>
  );
}

export default App;
