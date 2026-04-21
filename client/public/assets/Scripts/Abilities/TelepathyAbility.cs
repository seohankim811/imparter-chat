using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace LostCity.Abilities
{
    public class TelepathyAbility : AbilityBase
    {
        [SerializeField] private float _revealRadius = 15f;
        [SerializeField] private float _revealDuration = 10f;
        [SerializeField] private LayerMask _unitLayer;

        protected override void Activate(Vector3 targetPoint)
        {
            // Reveal from Sophie's position
            Vector3 center = transform.position;
            var hits = Physics.OverlapSphere(center, _revealRadius, _unitLayer);

            foreach (var hit in hits)
            {
                var disguised = hit.GetComponent<Units.DisguisedAgent>();
                if (disguised != null && !disguised.IsRevealed)
                    disguised.Reveal(_revealDuration);
            }

            // Visual effect
            StartCoroutine(ShowRevealEffect(center));
        }

        private IEnumerator ShowRevealEffect(Vector3 center)
        {
            // Spawn a temporary sphere indicator (replace with actual VFX prefab)
            var sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sphere.transform.position = center;
            sphere.transform.localScale = Vector3.one * _revealRadius * 2f;
            var r = sphere.GetComponent<Renderer>();
            r.material.color = new Color(0.3f, 0.7f, 1f, 0.3f);
            Destroy(sphere.GetComponent<Collider>());

            float t = 0f;
            while (t < 0.5f)
            {
                t += Time.deltaTime;
                r.material.color = new Color(0.3f, 0.7f, 1f, 0.3f * (1f - t / 0.5f));
                yield return null;
            }
            Destroy(sphere);
        }
    }
}
