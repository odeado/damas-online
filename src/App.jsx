import React from "react";
import { useEffect, useState } from "react";
import "./App.css";
import { db } from "./firebaseConfig";
import "./Board.css";

import { collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

import { query, where, limit } from "firebase/firestore";





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
const [opponentName, setOpponentName] = useState("");
const [opponentAvatar, setOpponentAvatar] = useState("🤖");


const [explodingPieces, setExplodingPieces] = useState([]);



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

  // ======= LIMPIEZA AUTOMÁTICA =======
  useEffect(() => {
    // Limpiar partidas antiguas al iniciar la app
    cleanupOldGames();
    
    // Y cada hora por si acaso
    const interval = setInterval(cleanupOldGames, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function cleanupOldGames() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 horas
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hora para partidas vacías
      
      const q = query(
        collection(db, "games"),
        where("createdAt", "<", oneDayAgo)
      );

      const snapshot = await getDocs(q);
      let deletedCount = 0;
      
      const deletePromises = snapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        
        // Eliminar si:
        // 1. Tiene más de 24 horas
        // 2. O si no tiene jugador 2 después de 1 hora
        // 3. O si el juego ya terminó (hay ganador)
        if ((data.createdAt && data.createdAt.toDate() < oneDayAgo) ||
            (!data.player2 && data.createdAt && data.createdAt.toDate() < oneHourAgo) ||
            data.winner) {
          await deleteDoc(docSnapshot.ref);
          deletedCount++;
        }
      });
      
      await Promise.all(deletePromises);
      
      if (deletedCount > 0) {
        console.log(`🧹 Limpiadas ${deletedCount} partidas antiguas`);
      }
    } catch (error) {
      console.error("Error limpiando partidas:", error);
    }
  }


  // ======= FIREBASE =======
 async function createRoom() {

     // Limpiar partidas antiguas antes de crear nueva
  await cleanupOldGames();

  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  const roomRef = doc(db, "games", id);

  try {
    await setDoc(roomRef, {
      board: JSON.stringify(initBoard()),
      turn: "red",
      winner: null,
      player1: true,
      player2: false,
      player1Data: {
        name: playerName || "Jugador Rojo",
        avatar: avatar || "🔴",
      },
      player2Data: null,
      createdAt: new Date()
    });

    setRoomId(id);
    setPlayerColor("red");
    setJoinedRoom(true);
    setWaitingForOpponent(true);
    setUserReady(true);
    
    // Mostrar el ID de manera más clara
    alert(`✅ Partida creada!\n\nID: ${id}\n\nComparte este ID con tu amigo para que se una.`);
    
  } catch (error) {
    console.error("Error al crear partida:", error);
    alert("Error al crear partida");
  }
}


async function joinRoom() {
  try {
    console.log("Buscando partidas disponibles...");
    
    const q = query(
      collection(db, "games"),
      where("player2", "==", false),
      where("winner", "==", null),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    console.log("Partidas encontradas:", querySnapshot.size);
    
    if (!querySnapshot.empty) {
      const gameDoc = querySnapshot.docs[0];
      const gameId = gameDoc.id;
      const data = gameDoc.data();
      
      console.log("Partida encontrada:", gameId, data);

      // Verificar que el jugador 1 ya esté listo
      if (data.player1 && !data.player2) {
        console.log("Uniéndose a la partida...");
        
        await updateDoc(doc(db, "games", gameId), {
          player2: true,
          player2Data: { 
            name: playerName || "Jugador Negro", 
            avatar: avatar || "⚫" 
          },
        });

        setRoomId(gameId);
        setPlayerColor("black");
        setJoinedRoom(true);
        setUserReady(true);
        setWaitingForOpponent(false);
        alert(`✅ Te uniste a la partida ${gameId}`);
        return;
      }
    }
    
    // Si no hay partidas disponibles
    alert("❌ No hay partidas disponibles. Crea una nueva partida.");
    
  } catch (error) {
    console.error("Error al unirse a la partida:", error);
    alert("Error al unirse a la partida: " + error.message);
  }
}


  // Escucha en tiempo real los cambios de la sala
useEffect(() => {
  if (!joinedRoom || !roomId) return;

  const unsub = onSnapshot(doc(db, "games", roomId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Actualizar estado del juego
      setBoard(JSON.parse(data.board || "[]"));
      setTurn(data.turn || "red");
      setWinner(data.winner);

      // 🔥 Detectar si ya entró el jugador 2
      if (playerColor === "red" && data.player2) {
        setWaitingForOpponent(false);
        
        // Actualizar datos del oponente
        if (data.player2Data) {
          setOpponentName(data.player2Data.name || "Jugador Negro");
          setOpponentAvatar(data.player2Data.avatar || "⚫");
        }
      }

      // ✅ Mostrar nombre y avatar del oponente
      if (playerColor === "black" && data.player1Data) {
        setOpponentName(data.player1Data.name || "Jugador Rojo");
        setOpponentAvatar(data.player1Data.avatar || "🔴");
      }

      // Si soy el jugador negro y me acabo de unir
      if (playerColor === "black" && data.player2) {
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

  const directions = [
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  for (const [dr, dc] of directions) {
    // ✅ PARA REINAS: verificar en toda la diagonal
    if (piece.king) {
      let currentRow = fromRow + dr;
      let currentCol = fromCol + dc;
      let foundOpponent = false;

      while (currentRow >= 0 && currentRow < BOARD_SIZE && 
             currentCol >= 0 && currentCol < BOARD_SIZE) {
        
        const cell = boardState[currentRow][currentCol];
        
        if (cell) {
          if (cell.color === piece.color) break; // Pieza propia, no puede saltar
          if (cell.color !== piece.color) {
            foundOpponent = true;
            // Verificar si hay espacio después para aterrizar
            const landRow = currentRow + dr;
            const landCol = currentCol + dc;
            
            if (landRow >= 0 && landRow < BOARD_SIZE && 
                landCol >= 0 && landCol < BOARD_SIZE &&
                boardState[landRow][landCol] === null) {
              return true;
            }
            break;
          }
        }
        
        currentRow += dr;
        currentCol += dc;
      }
    }
    // ✅ PARA FICHAS NORMALES
    else {
      const toRow = fromRow + 2 * dr;
      const toCol = fromCol + 2 * dc;
      
      if (toRow >= 0 && toRow < BOARD_SIZE && toCol >= 0 && toCol < BOARD_SIZE) {
        const midRow = fromRow + dr;
        const midCol = fromCol + dc;
        const jumped = boardState[midRow][midCol];
        const destination = boardState[toRow][toCol];
        
        if (jumped && jumped.color !== piece.color && !destination) {
          // Verificar dirección para fichas normales
          if (piece.color === "red" && dr > 0) continue;
          if (piece.color === "black" && dr < 0) continue;
          return true;
        }
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

  // ✅ MOVIMIENTOS PARA REINAS (pueden moverse cualquier distancia en diagonal)
  if (piece.king) {
    // Verificar que sea movimiento diagonal
    if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
    
    const rowStep = rowDiff > 0 ? 1 : -1;
    const colStep = colDiff > 0 ? 1 : -1;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    let jumpedPiece = null;
    let jumpPosition = null;

    // Verificar el camino
    while (currentRow !== toRow || currentCol !== toCol) {
      const cell = board[currentRow][currentCol];
      
      if (cell) {
        if (jumpedPiece) {
          // Ya saltamos una pieza, no puede saltar más de una
          return false;
        }
        if (cell.color === piece.color) {
          // No puede saltar sobre sus propias piezas
          return false;
        }
        // Es una pieza del oponente - marcamos que saltamos
        jumpedPiece = cell;
        jumpPosition = { row: currentRow, col: currentCol };
      }
      
      currentRow += rowStep;
      currentCol += colStep;
    }

    // Si saltamos una pieza, es una captura válida
    if (jumpedPiece) {
      return true;
    }
    
    // Si no saltamos, es un movimiento simple (solo si no debemos continuar capturando)
    return !mustContinue;
  }

  // ✅ MOVIMIENTOS PARA FICHAS NORMALES (solo 1 o 2 casillas)
  else {
    // Movimiento simple (sin captura)
    if (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1 && !mustContinue) {
      return piece.color === "red" ? rowDiff === -1 : rowDiff === 1;
    }

    // Movimiento de captura
    if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
      const midRow = (fromRow + toRow) / 2;
      const midCol = (fromCol + toCol) / 2;
      const jumped = board[midRow][midCol];
      
      if (jumped && jumped.color !== piece.color) {
        return piece.color === "red" ? rowDiff === -2 : rowDiff === 2;
      }
    }
  }

  return false;
}

async function handleClick(row, col) {
  if (!joinedRoom || winner) return;
  if (turn !== playerColor) return;

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
    let capturedPieces = [];

    // ✅ CAPTURAS PARA REINAS (pueden saltar múltiples piezas)
    if (moving.king) {
      const rowDiff = row - selected.row;
      const colDiff = col - selected.col;
      
      if (Math.abs(rowDiff) > 1) { // Si se mueve más de 1 casilla, es captura
        const rowStep = rowDiff > 0 ? 1 : -1;
        const colStep = colDiff > 0 ? 1 : -1;
        
        let currentRow = selected.row + rowStep;
        let currentCol = selected.col + colStep;

        // Buscar todas las piezas capturadas en el camino
        while (currentRow !== row || currentCol !== col) {
          const cell = board[currentRow][currentCol];
          
          if (cell && cell.color !== moving.color) {
            // Agregar animación para esta pieza capturada
            capturedPieces.push(`${currentRow}-${currentCol}`);
            // Eliminar la pieza capturada
            newBoard[currentRow][currentCol] = null;
            didCapture = true;
          }
          
          currentRow += rowStep;
          currentCol += colStep;
        }
      }
    }
    // ✅ CAPTURAS PARA FICHAS NORMALES
    else if (Math.abs(row - selected.row) === 2) {
      const midRow = (row + selected.row) / 2;
      const midCol = (col + selected.col) / 2;
      
      capturedPieces.push(`${midRow}-${midCol}`);
      newBoard[midRow][midCol] = null;
      didCapture = true;
    }

    // ✅ Aplicar animaciones de captura
    if (capturedPieces.length > 0) {
      setExplodingPieces((prev) => [...prev, ...capturedPieces]);
    }

    // ✅ Mover nuestra ficha a la nueva posición
    newBoard[row][col] = moving;

    // ✅ Convertir a rey si llega al final (solo para fichas normales)
    if (!moving.king) {
      if ((moving.color === "red" && row === 0) ||
          (moving.color === "black" && row === BOARD_SIZE - 1)) {
        moving.king = true;
        newBoard[row][col] = moving;
      }
    }

    // ✅ Contar fichas para ver si hay ganador
    const redCount = newBoard.flat().filter((c) => c?.color === "red").length;
    const blackCount = newBoard.flat().filter((c) => c?.color === "black").length;

    let newWinner = null;
    if (redCount === 0) newWinner = "⚫ ¡Gana negro!";
    else if (blackCount === 0) newWinner = "🔴 ¡Gana rojo!";

    // ✅ Verificar si puede seguir capturando
    if (didCapture && canCapture(row, col, newBoard)) {
      setBoard(newBoard);
      setSelected({ row, col });
      setMustContinue(true);
      
      await updateDoc(doc(db, "games", roomId), {
        board: JSON.stringify(newBoard),
        turn: turn,
        winner: newWinner,
      });
    } else {
      setBoard(newBoard);
      setSelected(null);
      setMustContinue(false);
      const nextTurn = turn === "red" ? "black" : "red";

      await updateDoc(doc(db, "games", roomId), {
        board: JSON.stringify(newBoard),
        turn: nextTurn,
        winner: newWinner,
      });


        // Si hay ganador, programar limpieza en 5 minutos
  if (newWinner) {
    setTimeout(() => {
      cleanupOldGames();
    }, 5 * 60 * 1000); // 5 minutos después de terminar

    }
    }
  
   // ✅ Limpiar animaciones después de un tiempo
    setTimeout(() => {
      setExplodingPieces([]);
    }, 600);
  } 
} 



if (!userReady) {
  return (
    <div className="welcome-screen">
      <h2>¡Bienvenido a Damas 👑!</h2>

      <input
        type="text"
        placeholder="Tu nombre"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        className="input-name"
      />

      <p>Elige tu foto de perfil:</p>
      <div className="avatar-options">
        <button
          id="abrir-camara"
          className="avatar-btn"
          onClick={async () => {
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
          }}
        >
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

      {/* Contenedor de cámara */}
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
        {avatar.startsWith("blob:") || avatar.startsWith("data:image") ? (
          <img src={avatar} alt="avatar" className="avatar-img" />
        ) : (
          <span className="avatar">{avatar}</span>
        )}
      </div>

      {/* 🎮 Botones del menú principal */}
      <div className="menu" style={{ marginTop: "20px" }}>
        <button
          onClick={() => {
            if (!playerName.trim()) {
              alert("Ingresa tu nombre antes de continuar");
              return;
            }
            createRoom();
            setUserReady(true);
          }}
          className="btn"
        >
          🎲 Nueva partida
        </button>

       <button
  onClick={() => {
    if (!playerName.trim()) {
      alert("Ingresa tu nombre antes de continuar");
      return;
    }
    joinRoom(); // ✅ ya no se pasan parámetros
    
  }}
  className="btn"
>
  🤝 Unirse a una partida
</button>

      </div>
    </div>
  );
}


// ✅ PANTALLA DE ESPERA MEJORADA:
if (joinedRoom && waitingForOpponent) {
  return (
    <div className="waiting-screen">
      <h2>⏳ Esperando oponente...</h2>
      <div className="room-id-box">
        <p>ID de la partida:</p>
        <h3 className="room-id">{roomId}</h3>
        <p>Comparte este ID con tu amigo</p>
      </div>
      <div className="player-info">
        <div className="avatar-preview">
          {avatar.startsWith("blob:") || avatar.startsWith("data:image") ? (
            <img src={avatar} alt="avatar" className="avatar-img" />
          ) : (
            <span className="avatar">{avatar}</span>
          )}
        </div>
        <p>{playerName} (Rojo)</p>
      </div>
    </div>
  );
}





 



  return (
    <div className="container-center">
      <h1>Damas Online 👑</h1>

    {!joinedRoom ? (
  <p>Uniéndote a la partida...</p>
) : waitingForOpponent ? (
  <div className="waiting">
    <p>⏳ Esperando que se una un oponente...</p>
  </div>
) : (
  <>
    {/* 🔥 Vista cara a cara grande */}
  </>
)}

{/* 🔥 Vista cara a cara compacta con turno arriba */}
<div className="versus-view compact">
  <div className="turn-display">
  {winner ? (
    <span className="winner-text">{winner}</span>
  ) : (
    <span>
      🎮 Turno de{" "}
      {turn === playerColor
        ? playerName || "Tú"
        : opponentName || "Oponente"}{" "}
      {mustContinue ? "– sigue capturando!" : ""}
    </span>
  )}
</div>


  <div className="versus-row">
    <div
  className={`player-card small ${
    turn === playerColor ? "active-turn" : ""
  }`}
>
      {avatar.startsWith("blob:") || avatar.startsWith("data:image") ? (
        <img src={avatar} alt="tú" className="versus-avatar small" />
      ) : (
        <span className="versus-avatar small">{avatar}</span>
      )}
      <p className="player-name">{playerName || "Tú"}</p>
    </div>

    <div className="vs-center small">⚡ VS ⚡</div>

    <div
  className={`player-card small ${
    turn !== playerColor ? "active-turn" : ""
  }`}
>
      {opponentAvatar.startsWith("blob:") ||
      opponentAvatar.startsWith("data:image") ? (
        <img
          src={opponentAvatar}
          alt="oponente"
          className="versus-avatar small"
        />
      ) : (
        <span className="versus-avatar small">{opponentAvatar}</span>
      )}
      <p className="player-name">{opponentName || "Esperando..."}</p>
      
    </div>
  </div>
</div>



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
    className={`piece ${cell.color} ${cell.king ? "king" : ""} ${
      explodingPieces.includes(`${rIndex}-${cIndex}`) ? "exploding" : ""
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
