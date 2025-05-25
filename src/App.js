import React, { useState, useEffect, useCallback, useRef } from "react";
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

const Card = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  width: 100%;
  max-width: 800px;
  margin-top: 20px;
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

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [, setSerialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [dataHistory, setDataHistory] = useState([]);
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY = 1000;
  const socketRef = useRef(null);

  useEffect(() => {
    // Load existing data from localStorage on mount
    const savedData = localStorage.getItem("serialDataHistory");
    if (savedData) {
      setDataHistory(JSON.parse(savedData));
    }
  }, []);

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
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSerialData(data);
        // Add to history if it's a server response or serialData response
        if (!data.action || data.action === "serialData") {
          const newEntry = {
            data,
            timestamp: new Date().toISOString()
          };
          setDataHistory((prevHistory) => {
            const updatedHistory = [newEntry, ...prevHistory].slice(0, 10); // Keep last 10 entries
            localStorage.setItem(
              "serialDataHistory",
              JSON.stringify(updatedHistory)
            );
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

  const clearHistory = () => {
    setDataHistory([]);
    localStorage.removeItem("serialDataHistory");
  };

  const resendSerialData = (data) => {
    if (socket && connected) {
      socket.send(JSON.stringify({ action: "setSerialData", data }));
    }
  };

  return (
    <Page>
      <ContentWrapper>
        <StatusIndicator $connected={connected}>
          {connected ? "Connected" : "Disconnected"}
        </StatusIndicator>

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
              {dataHistory.map((entry, index) => (
                <li key={entry.timestamp}>
                  <HistoryItem>
                    <div>
                      {new Date(entry.timestamp).toLocaleString()}:{" "}
                      {JSON.stringify(entry.data)}
                    </div>
                    <ResendButton
                      onClick={() => resendSerialData(entry.data)}
                      disabled={!connected}
                    >
                      Send
                    </ResendButton>
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
