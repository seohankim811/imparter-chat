using System;
using System.Collections.Generic;
using UnityEngine;

namespace LostCity.Core
{
    public class SelectionManager : MonoBehaviour
    {
        public static SelectionManager Instance { get; private set; }

        public List<ISelectable> CurrentSelection { get; } = new();
        public event Action<List<ISelectable>> OnSelectionChanged;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        public void Select(ISelectable target)
        {
            ClearSelection();
            if (target == null) return;
            CurrentSelection.Add(target);
            target.OnSelected();
            OnSelectionChanged?.Invoke(CurrentSelection);
        }

        public void AddToSelection(ISelectable target)
        {
            if (target == null || CurrentSelection.Contains(target)) return;
            CurrentSelection.Add(target);
            target.OnSelected();
            OnSelectionChanged?.Invoke(CurrentSelection);
        }

        public void BoxSelect(List<ISelectable> targets)
        {
            ClearSelection();
            foreach (var t in targets)
            {
                CurrentSelection.Add(t);
                t.OnSelected();
            }
            OnSelectionChanged?.Invoke(CurrentSelection);
        }

        public void ClearSelection()
        {
            foreach (var s in CurrentSelection)
                s?.OnDeselected();
            CurrentSelection.Clear();
            OnSelectionChanged?.Invoke(CurrentSelection);
        }
    }
}
