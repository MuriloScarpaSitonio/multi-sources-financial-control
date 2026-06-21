import { useState } from "react";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Colors, getColor } from "../../../../design-system";

const FileDropArea = ({ onFiles }: { onFiles: (files: FileList) => void }) => {
  const [dragActive, setDragActive] = useState(false);

  return (
    <Box
      component="label"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        p: 3,
        borderRadius: 2,
        cursor: "pointer",
        textAlign: "center",
        border: `1px dashed ${getColor(dragActive ? Colors.brand : Colors.neutral400)}`,
        backgroundColor: getColor(Colors.neutral700),
      }}
    >
      <input
        type="file"
        accept=".xlsx"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same files
        }}
      />
      <UploadFileIcon />
      <Typography variant="body2">
        Arraste os arquivos da B3 aqui ou clique para selecionar
      </Typography>
      <Typography variant="caption" color={getColor(Colors.neutral300)}>
        negociação, posição, movimentação e/ou proventos (.xlsx)
      </Typography>
    </Box>
  );
};

export default FileDropArea;
