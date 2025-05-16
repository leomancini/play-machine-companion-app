import React, { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 24px;
  color: #333;
`;

const StatusIndicator = styled.div`
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 20px;
  background-color: ${(props) => (props.connected ? "#4CAF50" : "#F44336")};
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
  margin-bottom: 20px;

  &:hover {
    background-color: #0052a3;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const DataDisplay = styled.div`
  border: 1px solid #ccc;
  padding: 20px;
  width: 80%;
  max-width: 600px;
  border-radius: 8px;
  background-color: #f9f9f9;
  margin-top: 20px;
  font-size: 16px;
`;

const HistoryList = styled.div`
  ul {
    list-style: none;
    padding: 0;
  }

  li {
    width: 100%;
    margin-bottom: 1rem;
  }
`;

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [serialData, setSerialData] = useState(null);
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

    console.log(`Using WebSocket URL: ${WEBSOCKET_URL}`);

    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      setConnected(true);
      setRetryCount(0);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      console.log("Message received:", event.data);
      try {
        const data = JSON.parse(event.data);
        setSerialData(data);
        // Add new data to history with timestamp
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
      console.log("Disconnected from WebSocket server");
      setConnected(false);
      setLoading(false);
      setSocket(null);

      if (socketRef.current === ws && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(
          `Connection lost. Retrying in ${delay / 1000} seconds... (Attempt ${
            retryCount + 1
          }/${MAX_RETRIES})`
        );

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

  return (
    <Page>
      <StatusIndicator connected={connected}>
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
          <h3>History:</h3>
          <ul>
            {dataHistory.map((entry, index) => (
              <li key={entry.timestamp}>
                {new Date(entry.timestamp).toLocaleString()}:{" "}
                {JSON.stringify(entry.data)}
              </li>
            ))}
          </ul>
        </HistoryList>
      )}
    </Page>
  );
}

export default App;
