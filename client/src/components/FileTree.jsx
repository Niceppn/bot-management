import { useState } from 'react'
import './FileTree.css'

function FileTree({ tree, onSelect, selectedFile }) {
  return (
    <div className="file-tree">
      {tree.map((item, index) => (
        <FileTreeItem
          key={index}
          item={item}
          onSelect={onSelect}
          selectedFile={selectedFile}
          level={0}
        />
      ))}
    </div>
  )
}

function FileTreeItem({ item, onSelect, selectedFile, level }) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleClick = () => {
    if (item.type === 'folder') {
      setIsExpanded(!isExpanded)
    } else {
      onSelect(item)
    }
  }

  const isSelected = selectedFile?.path === item.path

  return (
    <div className="tree-item">
      <div
        className={`tree-item-label ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleClick}
      >
        <span className="tree-icon">
          {item.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="tree-name">{item.name}</span>
      </div>
      {item.type === 'folder' && isExpanded && item.children && (
        <div className="tree-children">
          {item.children.map((child, index) => (
            <FileTreeItem
              key={index}
              item={child}
              onSelect={onSelect}
              selectedFile={selectedFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default FileTree
