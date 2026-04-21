using System.Collections;
using UnityEngine;
using UnityEngine.AI;

namespace LostCity.Abilities
{
    public class DebuffComponent : MonoBehaviour, Core.IDebuffable
    {
        private Units.UnitBase _unit;
        private NavMeshAgent _agent;
        private Coroutine _activeDebuff;

        private void Awake()
        {
            _unit = GetComponent<Units.UnitBase>();
            _agent = GetComponent<NavMeshAgent>();
        }

        public void ApplyDebuff(float damageReduction, float speedReduction, float duration)
        {
            if (_activeDebuff != null) StopCoroutine(_activeDebuff);
            _activeDebuff = StartCoroutine(RunDebuff(damageReduction, speedReduction, duration));
        }

        private IEnumerator RunDebuff(float damageReduction, float speedReduction, float duration)
        {
            float originalSpeed = _agent != null ? _agent.speed : 0f;
            if (_agent != null)
                _agent.speed = originalSpeed * (1f - speedReduction);

            // Tint renderer purple to indicate debuff
            var renderers = GetComponentsInChildren<Renderer>();
            foreach (var r in renderers)
                r.material.color = new Color(0.6f, 0.2f, 0.8f);

            yield return new WaitForSeconds(duration);

            if (_agent != null)
                _agent.speed = originalSpeed;

            foreach (var r in renderers)
                r.material.color = Color.white;

            _activeDebuff = null;
        }
    }
}
