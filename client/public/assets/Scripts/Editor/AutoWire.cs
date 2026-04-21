// ScriptableObject와 프리팹을 씬 컴포넌트에 자동 연결합니다.
#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;

namespace LostCity.Editor
{
    public static class AutoWire
    {
        [MenuItem("LostCity/4. Auto-Wire Scene")]
        public static void Wire()
        {
            int wired = 0;

            // ─── FoxfireAcademy에 훈련 가능 유닛 연결 ──────────────────────
            var academy = Object.FindFirstObjectByType<Buildings.FoxfireAcademy>();
            if (academy != null)
            {
                var elfData = AssetDatabase.LoadAssetAtPath<Data.UnitData>("Assets/Data/Units/Ability_Elf.asset");
                var goblinData = AssetDatabase.LoadAssetAtPath<Data.UnitData>("Assets/Data/Units/Goblin_Guard.asset");
                // _trainableUnits는 직렬화 필드이므로 SerializedObject로 접근
                var so = new SerializedObject(academy);
                var trainable = so.FindProperty("_trainableUnits");
                if (trainable != null)
                {
                    trainable.ClearArray();
                    if (elfData) { trainable.InsertArrayElementAtIndex(0); trainable.GetArrayElementAtIndex(0).objectReferenceValue = elfData; }
                    if (goblinData) { trainable.InsertArrayElementAtIndex(1); trainable.GetArrayElementAtIndex(1).objectReferenceValue = goblinData; }
                    so.ApplyModifiedProperties();
                    wired++;
                }
            }

            // ─── AIController에 NeverseenBase, UnitData 연결 ───────────────
            var aiCtrl = Object.FindFirstObjectByType<AI.AIController>();
            var neverseenBase = Object.FindFirstObjectByType<Buildings.NeverseenBase>();
            if (aiCtrl != null && neverseenBase != null)
            {
                var so = new SerializedObject(aiCtrl);
                var baseProp = so.FindProperty("_neverseenBase");
                if (baseProp != null) { baseProp.objectReferenceValue = neverseenBase; wired++; }

                var agentData = AssetDatabase.LoadAssetAtPath<Data.UnitData>("Assets/Data/Units/Neverseen_Agent.asset");
                var disguisedData = AssetDatabase.LoadAssetAtPath<Data.UnitData>("Assets/Data/Units/Disguised_Agent.asset");
                var agentProp = so.FindProperty("_agentData");
                var disguisedProp = so.FindProperty("_disguisedAgentData");
                var resProp = so.FindProperty("_resources");
                var aiRes = aiCtrl.GetComponent<AI.AIResourceManager>();

                if (agentProp != null && agentData) { agentProp.objectReferenceValue = agentData; wired++; }
                if (disguisedProp != null && disguisedData) { disguisedProp.objectReferenceValue = disguisedData; wired++; }
                if (resProp != null && aiRes) { resProp.objectReferenceValue = aiRes; wired++; }
                so.ApplyModifiedProperties();
            }

            // ─── CommandDispatcher에 카메라 연결 ───────────────────────────
            var dispatcher = Object.FindFirstObjectByType<Player.CommandDispatcher>();
            if (dispatcher != null)
            {
                var so = new SerializedObject(dispatcher);
                var camProp = so.FindProperty("_cam");
                if (camProp != null)
                {
                    camProp.objectReferenceValue = Camera.main;
                    so.ApplyModifiedProperties();
                    wired++;
                }
            }

            // ─── SelectionPanel의 ResourceUI에 TMP 연결 ────────────────────
            var resourceUI = Object.FindFirstObjectByType<UI.ResourceUI>();
            if (resourceUI != null)
            {
                var so = new SerializedObject(resourceUI);
                var textProp = so.FindProperty("_crystalText");
                if (textProp != null)
                {
                    var tmp = resourceUI.GetComponentInChildren<TMPro.TextMeshProUGUI>();
                    if (tmp) { textProp.objectReferenceValue = tmp; so.ApplyModifiedProperties(); wired++; }
                }
            }

            UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
                UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());

            EditorUtility.DisplayDialog("Auto-Wire 완료",
                $"{wired}개 컴포넌트 연결 완료!\n\n남은 수동 작업:\n• 각 UnitData/BuildingData에 Prefab 연결\n• SophieFoster 프리팹을 씬에 배치\n• NavMesh Bake",
                "확인");
        }
    }
}
#endif
