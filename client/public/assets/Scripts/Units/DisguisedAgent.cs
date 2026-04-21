using System.Collections;
using UnityEngine;
using LostCity.Core;

namespace LostCity.Units
{
    public class DisguisedAgent : UnitBase
    {
        [SerializeField] private Material _disguiseMaterial;
        [SerializeField] private Material _revealedMaterial;

        public bool IsRevealed { get; private set; }

        // While disguised, appear as ElfCouncil to fool selection and targeting
        public override Faction Faction => IsRevealed ? Core.Faction.Neverseen : Core.Faction.ElfCouncil;

        protected override void Awake()
        {
            base.Awake();
            ApplyMaterial(_disguiseMaterial);
        }

        public void Reveal(float duration = 0f)
        {
            if (IsRevealed) return;
            IsRevealed = true;
            ApplyMaterial(_revealedMaterial);
            if (duration > 0f)
                StartCoroutine(RevertAfter(duration));
        }

        private IEnumerator RevertAfter(float duration)
        {
            yield return new WaitForSeconds(duration);
            IsRevealed = false;
            ApplyMaterial(_disguiseMaterial);
        }

        private void ApplyMaterial(Material mat)
        {
            if (mat == null) return;
            foreach (var r in GetComponentsInChildren<Renderer>())
                r.material = mat;
        }
    }
}
