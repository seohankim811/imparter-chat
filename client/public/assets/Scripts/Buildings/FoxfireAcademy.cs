using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using LostCity.Data;
using LostCity.Core;

namespace LostCity.Buildings
{
    public class FoxfireAcademy : BuildingBase, IProducer
    {
        [SerializeField] private int _maxQueueSize = 5;
        [SerializeField] private List<UnitData> _trainableUnits;

        private readonly Queue<UnitData> _trainingQueue = new();
        private bool _isTraining;

        public IReadOnlyCollection<UnitData> TrainingQueue => _trainingQueue;
        public bool IsTraining => _isTraining;

        public void QueueUnit(UnitData unitData)
        {
            if (_trainingQueue.Count >= _maxQueueSize) return;
            if (!ResourceManager.Instance.TrySpend(unitData.CrystalCost)) return;

            _trainingQueue.Enqueue(unitData);
            if (!_isTraining)
                StartCoroutine(ProcessQueue());
        }

        private IEnumerator ProcessQueue()
        {
            _isTraining = true;
            while (_trainingQueue.Count > 0)
            {
                var unitData = _trainingQueue.Dequeue();
                yield return new WaitForSeconds(unitData.TrainingTime);

                if (!IsDestroyed)
                    Units.UnitFactory.Instance?.Spawn(unitData, RallyPoint.position, Quaternion.identity);
            }
            _isTraining = false;
        }

        public List<UnitData> GetTrainableUnits() => _trainableUnits;
    }
}
