import React from "react";
import { useEffect, useState } from "react";
import "./App.css";
import { db } from "./firebaseConfig";
import "./Board.css";

import { collection, getDocs, updateDoc } from "firebase/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";


const BOARD_SIZE = 8;

  function initBoard() {
    const newBoard = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((row + col) % 2 === 1)
          newBoard[row][col] = { color: "black", king: false };
      }
    }

    for (let row = BOARD_SIZE - 3; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((row + col) % 2 === 1)
          newBoard[row][col] = { color: "red", king: false };
      }
    }

    return newBoard;
  }

function App() {
  const [board, setBoard] = useState(initBoard());
  const [selected, setSelected] = useState(null);
  const [turn, setTurn] = useState("red");
  const [mustContinue, setMustContinue] = useState(false);
  const [winner, setWinner] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [playerColor, setPlayerColor] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const [playerName, setPlayerName] = useState("");
const [avatar, setAvatar] = useState("😊");
const [userReady, setUserReady] = useState(false);


useEffect(() => {
  const botonCamara = document.getElementById("abrir-camara");
  if (!botonCamara) return;

  botonCamara.addEventListener("click", async () => {
    const contenedor = document.getElementById("contenedor-camara");
    const video = document.getElementById("video-camara");
    contenedor.style.display = "flex";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
    } catch (err) {
      alert("No se pudo acceder a la cámara.");
      contenedor.style.display = "none";
    }
  });

  return () => botonCamara.removeEventListener("click", () => {});
}, []);




  // ======= FIREBASE =======
  async function createRoom() {
    const id = Math.random().toString(36).substring(2, 8);
    const roomRef = doc(db, "games", id);

    await setDoc(roomRef, {
    board: JSON.stringify(initBoard()),
    turn: "red",
    winner: null,
    player1: true,
    player2: false,
  });

    setRoomId(id);
  setPlayerColor("red");
  setJoinedRoom(true);
  setWaitingForOpponent(true);
  alert(`✅ Partida creada con ID: ${id}. Esperando oponente...`);
}

 // Unirse automáticamente a la primera sala disponible
async function joinRoom() {
  // Traemos todas las partidas de la colección "games"
  const querySnapshot = await getDocs(collection(db, "games"));

  let found = false;

  for (const gameDoc of querySnapshot.docs) {
    const data = gameDoc.data();
    // Ignoramos si ya tiene los dos jugadores o hay un ganador
    if (data.player1 && !data.player2 && !data.winner) {
      await updateDoc(doc(db, "games", gameDoc.id), { player2: true });
      setRoomId(gameDoc.id);
      setPlayerColor("black");
      setJoinedRoom(true);
      alert(`✅ Te uniste a la partida ${gameDoc.id}`);
      found = true;
      break;
    }
  }

  if (!found) {
    alert("❌ No hay partidas disponibles. Crea una nueva.");
  }
}


  // Escucha en tiempo real los cambios de la sala
useEffect(() => {
  if (!joinedRoom || !roomId) return;

  const unsub = onSnapshot(doc(db, "games", roomId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      setBoard(JSON.parse(data.board));
      setTurn(data.turn);
      setWinner(data.winner);

      // 🔥 Nuevo: detectar si ya entró el jugador 2
      if (playerColor === "red" && data.player2) {
        setWaitingForOpponent(false);
      }
    }
  });

  return () => unsub();
}, [joinedRoom, roomId, playerColor]);


  // ======= LÓGICA DEL JUEGO =======
  function canCapture(fromRow, fromCol, boardState) {
    const piece = boardState[fromRow][fromCol];
    if (!piece) return false;

    const dirs = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    for (const [dr, dc] of dirs) {
      if (!piece.king && piece.color === "red" && dr > 0) continue;
      if (!piece.king && piece.color === "black" && dr < 0) continue;

      const midRow = fromRow + dr;
      const midCol = fromCol + dc;
      const endRow = fromRow + 2 * dr;
      const endCol = fromCol + 2 * dc;

      if (
        endRow >= 0 &&
        endRow < BOARD_SIZE &&
        endCol >= 0 &&
        endCol < BOARD_SIZE
      ) {
        const middle = boardState[midRow][midCol];
        const end = boardState[endRow][endCol];
        if (middle && middle.color !== piece.color && !end) {
          return true;
        }
      }
    }
    return false;
  }

  function isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;
    const target = board[toRow][toCol];
    if (target) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const dir = piece.color === "red" ? -1 : 1;

    if (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1 && !mustContinue) {
      if (piece.king) return true;
      return rowDiff === dir;
    }

    if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
      const midRow = (fromRow + toRow) / 2;
      const midCol = (fromCol + toCol) / 2;
      const jumped = board[midRow][midCol];
      if (jumped && jumped.color !== piece.color) {
        if (piece.king) return true;
        return rowDiff === 2 * dir;
      }
    }

    return false;
  }

  async function handleClick(row, col) {
    if (!joinedRoom || winner) return;
    if (turn !== playerColor) return; // solo mueve tu color

    const piece = board[row][col];
    if (piece && piece.color === turn && !mustContinue) {
      setSelected({ row, col });
      return;
    }

    if (selected && isValidMove(selected.row, selected.col, row, col)) {
      const newBoard = board.map((r) => [...r]);
      const moving = { ...newBoard[selected.row][selected.col] };
      newBoard[selected.row][selected.col] = null;

      let didCapture = false;
      if (Math.abs(row - selected.row) === 2) {
        const midRow = (row + selected.row) / 2;
        const midCol = (col + selected.col) / 2;
        newBoard[midRow][midCol] = null;
        didCapture = true;
      }

      newBoard[row][col] = moving;

      if (
        (moving.color === "red" && row === 0) ||
        (moving.color === "black" && row === BOARD_SIZE - 1)
      ) {
        moving.king = true;
      }

      const redCount = newBoard.flat().filter((c) => c?.color === "red").length;
      const blackCount = newBoard
        .flat()
        .filter((c) => c?.color === "black").length;

      let newWinner = null;
      if (redCount === 0) newWinner = "⚫ ¡Gana negro!";
      else if (blackCount === 0) newWinner = "🔴 ¡Gana rojo!";

      if (didCapture && canCapture(row, col, newBoard)) {
        setBoard(newBoard);
        setSelected({ row, col });
        setMustContinue(true);
      } else {
        setBoard(newBoard);
        setSelected(null);
        setMustContinue(false);
        const nextTurn = turn === "red" ? "black" : "red";

        // Guardar en Firestore
        const roomRef = doc(db, "games", roomId);
        await updateDoc(roomRef, {
          board: JSON.stringify(newBoard), // ✅ lo guardamos como texto
          turn: nextTurn,
          winner: newWinner,
        });
      }
    }
  }



if (!userReady) {
  return (
    <div className="welcome-screen">
      <h2>¡Bienvenida a Damas Online 👑!</h2>

      <input
        type="text"
        placeholder="Tu nombre"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        className="input-name"
      />

      <p>Elige tu foto de perfil:</p>
<div className="avatar-options">
  <button id="abrir-camara" className="avatar-btn">
    📷 Usar Cámara
  </button>
  <label className="avatar-btn">
    🖼️ Subir Imagen
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setAvatar(url);
        }
      }}
      style={{ display: "none" }}
    />
  </label>
  <button
    className="avatar-btn"
    onClick={() => {
      const emojis = ["😊", "😎", "🤩", "😺", "👻", "🤖", "🦊", "🐵"];
      const random = emojis[Math.floor(Math.random() * emojis.length)];
      setAvatar(random);
    }}
  >
    😊 Usar Emoji
  </button>
</div>

{/* 👇 Agregamos el contenedor de cámara aquí */}
<div id="contenedor-camara" style={{ display: "none" }}>
  <div className="camara-box">
    <h3>📷 Captura tu imagen</h3>
    <video id="video-camara" autoPlay playsInline></video>
    <canvas id="canvas-camara"></canvas>
    <div style={{ marginTop: "15px" }}>
      <button
        id="btn-capturar"
        className="btn-camara"
        onClick={() => {
          const video = document.getElementById("video-camara");
          const canvas = document.getElementById("canvas-camara");
          const ctx = canvas.getContext("2d");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageUrl = canvas.toDataURL("image/png");
          setAvatar(imageUrl);
          document.getElementById("contenedor-camara").style.display = "none";
          video.srcObject.getTracks().forEach((track) => track.stop());
        }}
      >
        📸 Capturar
      </button>
      <button
        id="btn-cancelar-camara"
        className="btn-camara"
        onClick={() => {
          const video = document.getElementById("video-camara");
          document.getElementById("contenedor-camara").style.display = "none";
          if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
        }}
      >
        ❌ Cancelar
      </button>
    </div>
  </div>
</div>



     <div className="avatar-preview">
  {avatar.startsWith("blob:") ? (
    <img src={avatar} alt="avatar" className="avatar-img" />
  ) : (
    <span className="avatar">{avatar}</span>
  )}
</div>


      <button
        disabled={!playerName}
        onClick={() => setUserReady(true)}
        className="btn-start"
      >
        Continuar 💖
      </button>
    </div>
  );
}



  return (
    <div className="flex flex-col items-center mt-4">
      <h1>Damas Online 👑</h1>

    {!joinedRoom ? (
  <div className="menu">
    <button onClick={createRoom} className="btn">
      🎲 Nueva partida
    </button>
    <button onClick={joinRoom} className="btn">
      🤝 Unirse a una partida
    </button>
  </div>
) : waitingForOpponent ? (
  <div className="waiting">
    <p>⏳ Esperando que se una un oponente...</p>
  </div>
) : (
  <>
   <div className="player-info">
  <span className="avatar">{avatar}</span>
  <span className="player-name">{playerName}</span>
  <span> | Eres: {playerColor === "red" ? "🔴 Rojo" : "⚫ Negro"}</span>
</div>

    {winner ? (
      <h2 style={{ color: "green" }}>{winner}</h2>
    ) : (
      <p>
        Turno: {turn === "red" ? "🔴 Rojo" : "⚫ Negro"}{" "}
        {mustContinue ? "– sigue capturando!" : ""}
      </p>
    )}
  </>
)}



     <div className="board">
  {board.map((row, rIndex) =>
    row.map((cell, cIndex) => {
      const isDark = (rIndex + cIndex) % 2 === 1;
      const isSelected =
        selected &&
        selected.row === rIndex &&
        selected.col === cIndex;

      return (
        <div
          key={`${rIndex}-${cIndex}`}
          onClick={() => handleClick(rIndex, cIndex)}
          className={`cell ${isDark ? "dark" : "light"} ${
            isSelected ? "selected" : ""
          }`}
        >
          {cell && (
            <div
              className={`piece ${cell.color} ${
                cell.king ? "king" : ""
              }`}
            />
          )}
        </div>
      );
    })
  )}
</div>


      <button
  onClick={() => {
    setBoard(initBoard());
    setTurn("red");
    setSelected(null);
    setMustContinue(false);
    setWinner(null);
    if (roomId)
      updateDoc(doc(db, "games", roomId), {
        board: JSON.stringify(initBoard()),
        turn: "red",
        winner: null,
      });
  }}
  className="reset-btn"
>
  Reiniciar
</button>

    </div>
  );
}

export default App;
