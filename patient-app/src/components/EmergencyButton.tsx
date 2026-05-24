import React, { useState, useEffect, useCallback } from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Modal,
  Linking,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { crisisAPI } from '../services/api'

interface Contact {
  name: string
  phone: string
  desc: string
}

const BUILTIN_CONTACTS: Contact[] = [
  {
    name: '24小时心理援助热线',
    phone: '400-161-9995',
    desc: '全国心理危机干预热线',
  },
  { name: '生命热线', phone: '400-821-1215', desc: '全国24小时' },
  { name: '急救电话', phone: '120', desc: '医疗急救' },
  { name: '报警电���', phone: '110', desc: '紧急求助' },
]

const STORAGE_KEY = 'custom_emergency_contacts'

function callPhone(phone: string) {
  const url = `tel:${phone.replace(/-/g, '')}`
  if (Platform.OS === 'web') {
    window.open(url, '_self')
  } else {
    Linking.openURL(url)
  }
}

/**
 * Import contacts from the device.
 * - Native (iOS/Android): uses expo-contacts
 * - Web (Chrome on Android): uses Contact Picker API
 * Returns an array of { name, phone } or null if unavailable/cancelled.
 */
async function pickContactsFromDevice(): Promise<
  { name: string; phone: string }[] | null
> {
  // ── Native: expo-contacts ──
  if (Platform.OS !== 'web') {
    try {
      const Contacts = require('expo-contacts')
      const { status } = await Contacts.requestPermissionsAsync()
      if (status !== 'granted') {
        return null
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      })
      if (!data || data.length === 0) return null

      return data
        .filter((c: any) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c: any) => ({
          name: c.name || c.firstName || '未知',
          phone: c.phoneNumbers[0].number || '',
        }))
    } catch {
      return null
    }
  }

  // ── Web: Contact Picker API (Chrome Android) ──
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const props = ['name', 'tel']
      const contacts = await (navigator as any).contacts.select(props, {
        multiple: true,
      })
      if (!contacts || contacts.length === 0) return null
      return contacts
        .filter((c: any) => c.tel && c.tel.length > 0)
        .map((c: any) => ({
          name: c.name?.[0] || '未知',
          phone: c.tel[0],
        }))
    } catch {
      return null
    }
  }

  return null
}

export default function EmergencyButton() {
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState(false)
  const [customContacts, setCustomContacts] = useState<Contact[]>([])
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [importing, setImporting] = useState(false)
  const [pickedContacts, setPickedContacts] = useState<
    { name: string; phone: string }[] | null
  >(null)

  const loadCustomContacts = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY)
      if (data) setCustomContacts(JSON.parse(data))
    } catch {}
  }, [])

  useEffect(() => {
    loadCustomContacts()
  }, [loadCustomContacts])

  const saveCustomContacts = async (contacts: Contact[]) => {
    setCustomContacts(contacts)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
  }

  const handleAdd = () => {
    const name = newName.trim()
    const phone = newPhone.trim()
    if (!name || !phone) return
    const updated = [...customContacts, { name, phone, desc: '自定义联系人' }]
    saveCustomContacts(updated)
    setNewName('')
    setNewPhone('')
  }

  const handleDelete = (index: number) => {
    const updated = customContacts.filter((_, i) => i !== index)
    saveCustomContacts(updated)
  }

  const handleImport = async () => {
    setImporting(true)
    const contacts = await pickContactsFromDevice()
    setImporting(false)

    if (contacts === null) {
      // Not supported or denied — show a hint
      if (Platform.OS === 'web') {
        window.alert(
          '当前浏览器不支持读取通讯录，请手动输入联系人。\n\n提示：在手机端使用本应用可直接导入通讯录。',
        )
      }
      return
    }

    if (contacts.length === 0) return

    // Show picker list to select which ones to add
    setPickedContacts(contacts)
  }

  const handlePickConfirm = (selected: { name: string; phone: string }[]) => {
    const newOnes: Contact[] = selected.map((c) => ({
      name: c.name,
      phone: c.phone,
      desc: '通讯录导入',
    }))
    const updated = [...customContacts, ...newOnes]
    saveCustomContacts(updated)
    setPickedContacts(null)
  }

  return (
    <>
      <TouchableOpacity
        style={styles.sosButton}
        onPress={() => {
          setVisible(true)
          setEditing(false)
          setPickedContacts(null)
          // 创建危机告警记录
          AsyncStorage.getItem('user_info')
            .then((raw) => {
              const userId = raw ? JSON.parse(raw).id : undefined
              if (userId) {
                crisisAPI
                  .create({
                    user: userId,
                    level: 'high',
                    description: '患者主动发起紧急求助',
                  })
                  .catch(() => {})
              }
            })
            .catch(() => {})
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>紧急求助</Text>
            <Text style={styles.panelSubtitle}>点击号码直接拨打</Text>

            {/* Contact Picker from device */}
            {pickedContacts ? (
              <ContactPicker
                contacts={pickedContacts}
                onConfirm={handlePickConfirm}
                onCancel={() => setPickedContacts(null)}
              />
            ) : (
              <>
                <ScrollView style={styles.contactList}>
                  {customContacts.map((c, i) => (
                    <View key={`custom-${i}`} style={styles.contactRow}>
                      <TouchableOpacity
                        style={styles.contactTouchable}
                        onPress={() => callPhone(c.phone)}
                        activeOpacity={0.6}
                      >
                        <View style={styles.contactInfo}>
                          <View style={styles.nameRow}>
                            <View
                              style={[
                                styles.badge,
                                c.desc === '通讯录导入'
                                  ? styles.badgeImport
                                  : styles.badgeCustom,
                              ]}
                            >
                              <Text style={styles.badgeText}>
                                {c.desc === '通讯录导入' ? '导入' : '自定义'}
                              </Text>
                            </View>
                            <Text style={styles.contactName}>{c.name}</Text>
                          </View>
                        </View>
                        <Text style={styles.contactPhone}>{c.phone}</Text>
                      </TouchableOpacity>
                      {editing && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDelete(i)}
                        >
                          <Text style={styles.deleteBtnText}>删除</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {BUILTIN_CONTACTS.map((c) => (
                    <TouchableOpacity
                      key={c.phone}
                      style={styles.contactRow}
                      onPress={() => callPhone(c.phone)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{c.name}</Text>
                        <Text style={styles.contactDesc}>{c.desc}</Text>
                      </View>
                      <Text style={styles.contactPhone}>{c.phone}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {editing && (
                  <View style={styles.addForm}>
                    <Text style={styles.addFormTitle}>添加紧急联系人</Text>

                    <TouchableOpacity
                      style={[
                        styles.importBtn,
                        importing && styles.addBtnDisabled,
                      ]}
                      onPress={handleImport}
                      disabled={importing}
                    >
                      <Text style={styles.importBtnText}>
                        {importing ? '读取中...' : '从通讯录导入'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>或手动输入</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <TextInput
                      style={styles.input}
                      placeholder="姓名"
                      value={newName}
                      onChangeText={setNewName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="电话号码"
                      value={newPhone}
                      onChangeText={setNewPhone}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addBtn,
                        (!newName.trim() || !newPhone.trim()) &&
                          styles.addBtnDisabled,
                      ]}
                      onPress={handleAdd}
                      disabled={!newName.trim() || !newPhone.trim()}
                    >
                      <Text style={styles.addBtnText}>添加</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.bottomBtns}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setEditing(!editing)}
                  >
                    <Text style={styles.editBtnText}>
                      {editing ? '完成编辑' : '管理联系人'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setVisible(false)}
                  >
                    <Text style={styles.closeBtnText}>关闭</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

/** Sub-component: pick which device contacts to import */
function ContactPicker({
  contacts,
  onConfirm,
  onCancel,
}: {
  contacts: { name: string; phone: string }[]
  onConfirm: (selected: { name: string; phone: string }[]) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((_, i) => i)))
    }
  }

  return (
    <View>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>选择要导入的联系人</Text>
        <TouchableOpacity onPress={selectAll}>
          <Text style={styles.selectAllText}>
            {selected.size === contacts.length ? '取消全选' : '全选'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.pickerList}>
        {contacts.map((c, i) => (
          <TouchableOpacity
            key={i}
            style={styles.pickerRow}
            onPress={() => toggle(i)}
            activeOpacity={0.6}
          >
            <View
              style={[
                styles.checkbox,
                selected.has(i) && styles.checkboxChecked,
              ]}
            >
              {selected.has(i) && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.pickerInfo}>
              <Text style={styles.pickerName}>{c.name}</Text>
              <Text style={styles.pickerPhone}>{c.phone}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.bottomBtns}>
        <TouchableOpacity
          style={[styles.addBtn, selected.size === 0 && styles.addBtnDisabled]}
          onPress={() => onConfirm(contacts.filter((_, i) => selected.has(i)))}
          disabled={selected.size === 0}
        >
          <Text style={styles.addBtnText}>导入 {selected.size} 个联系人</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
          <Text style={styles.closeBtnText}>取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sosButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  sosText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 4,
  },
  panelSubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  contactList: { maxHeight: 260 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactInfo: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  badgeCustom: { backgroundColor: '#4A90D9' },
  badgeImport: { backgroundColor: '#2ECC71' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  contactName: { fontSize: 15, fontWeight: '600', color: '#333' },
  contactDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  contactPhone: { fontSize: 16, fontWeight: 'bold', color: '#4A90D9' },
  deleteBtn: {
    marginLeft: 8,
    backgroundColor: '#fee',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: { color: '#E74C3C', fontSize: 13, fontWeight: '600' },
  addForm: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  addFormTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  importBtn: {
    backgroundColor: '#2ECC71',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  importBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 10, fontSize: 12, color: '#999' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    flex: 1,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  bottomBtns: { flexDirection: 'row', marginTop: 16, gap: 10 },
  editBtn: {
    flex: 1,
    backgroundColor: '#E8F4FD',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 15, color: '#4A90D9', fontWeight: '600' },
  closeBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, color: '#666', fontWeight: '600' },
  // Contact Picker sub-component
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  selectAllText: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
  pickerList: { maxHeight: 320 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pickerInfo: { flex: 1 },
  pickerName: { fontSize: 15, fontWeight: '600', color: '#333' },
  pickerPhone: { fontSize: 13, color: '#888', marginTop: 2 },
})
